/**
 * Scores extraction prompts against the reviewed datasheets. The reviewers'
 * confirmed and corrected values are the answer key, so a prompt change can
 * be measured before it ships.
 *
 * Read-only: it finds reviewed baselines in MongoDB and reads their PDFs from
 * R2 (the retained upload, or the cached copy of a URL source; never the
 * vendor), and writes nothing to either. Results go to .eval/ (git-ignored).
 * Live runs call OpenAI and cost money: about $0.20 a datasheet with Terra at
 * high effort, so about $8 for every reviewed datasheet.
 *
 *   npm run score -- --stored                         # score what the reviewers saw (free)
 *   npm run score -- --prompt v2 --limit 3            # try v2 on three datasheets
 *   npm run score -- --prompt v2                      # every reviewed datasheet
 *   npm run score -- --prompt v1 --part SS25-LTP      # one datasheet with the old prompt
 *   npm run score -- --compare .eval/a.json .eval/b.json
 *   npm run score -- --rescore .eval/a.json            # score saved answers again (free)
 *
 * Options: --prompt v1|v2, --model <id>, --effort <effort>, --part <part
 * number> (repeatable), --limit N, --concurrency N (default 3),
 * --include-doubtful, --out <file>.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MongoClient, type Document } from "mongodb";

import { extractDatasheet } from "@/lib/ai";
import {
  DEFAULT_EXTRACTION_PROMPT_VERSION,
  getTwoTerminalKind,
  isExtractionPromptVersion,
  type ExtractionPromptVersion,
} from "@/lib/ai/extraction-rules";
import { resolveExtractionSettings } from "@/lib/ai/settings";
import { normalizePdfFileName } from "@/lib/pdf";
import { readCachedUrlSourcePdf } from "@/lib/pdf-cache";
import { downloadObjectBytes } from "@/lib/r2";
import {
  evaluateExtraction,
  sumTallies,
  type EvalTally,
  type ExtractionEval,
} from "@/lib/submissions/extraction-eval";
import { buildExtractionSnapshot } from "@/lib/submissions/extraction-snapshot";
import { normalizeSubmissionReview } from "@/lib/submissions/review";
import { hasRetainedUploadSource } from "@/lib/submissions/source";
import type {
  ExtractionSnapshot,
  SubmissionHumanReview,
  SubmissionIntakeSnapshot,
} from "@/lib/submissions/types";

const COLLECTION_NAME = "datasheet_submissions";
const EVAL_DIRECTORY = ".eval";

/**
 * Reviews from the November 2026 database review that look wrong, so they
 * would mark right answers as wrong: NE555DR (pin pitch "0-8 Degrees"),
 * CDSOT23-T08LC-Q (a correction noted "testing"), LMG1025 (pin length and
 * width swapped against every other chip) and SM91522AL (pins confirmed as
 * "Not specified"). Leave them out until someone re-checks them.
 */
const DOUBTFUL_PARTS = new Set(["NE555DR", "CDSOT23-T08LC-Q", "LMG1025QDEETQ1", "SM91522AL"]);

type Options = {
  compare: [string, string] | null;
  rescore: string | null;
  concurrency: number;
  effort: string | undefined;
  includeDoubtful: boolean;
  limit: number | null;
  model: string | undefined;
  out: string | null;
  parts: string[];
  promptVersion: ExtractionPromptVersion;
  stored: boolean;
};

type Baseline = {
  extraction: ExtractionSnapshot;
  intake: SubmissionIntakeSnapshot;
  review: SubmissionHumanReview;
  submissionId: string;
};

type SheetResult = {
  candidate?: ExtractionSnapshot;
  category: string;
  costUsd: number | null;
  error?: string;
  eval?: ExtractionEval;
  latencyMs: number | null;
  partNumber: string;
  status: "scored" | "skipped" | "failed";
  submissionId: string;
};

type RunFile = {
  createdAt: string;
  label: string;
  settings: {
    model: string | null;
    promptVersion: ExtractionPromptVersion | null;
    reasoningEffort: string | null;
    stored: boolean;
  };
  sheets: SheetResult[];
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readOptions(argv: string[]): Options {
  const options: Options = {
    compare: null,
    concurrency: 3,
    effort: undefined,
    includeDoubtful: false,
    limit: null,
    model: undefined,
    out: null,
    parts: [],
    promptVersion: DEFAULT_EXTRACTION_PROMPT_VERSION,
    rescore: null,
    stored: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = () => argv[++index] ?? fail(`${flag} needs a value.`);

    switch (flag) {
      case "--compare":
        options.compare = [next(), next()];
        break;
      case "--concurrency":
        options.concurrency = Math.max(1, Number.parseInt(next(), 10) || 1);
        break;
      case "--effort":
        options.effort = next();
        break;
      case "--include-doubtful":
        options.includeDoubtful = true;
        break;
      case "--limit":
        options.limit = Math.max(1, Number.parseInt(next(), 10) || 1);
        break;
      case "--model":
        options.model = next();
        break;
      case "--out":
        options.out = next();
        break;
      case "--part":
        options.parts.push(next());
        break;
      case "--prompt": {
        const version = next();

        if (!isExtractionPromptVersion(version)) {
          fail(`Unknown prompt version "${version}".`);
        }

        options.promptVersion = version;
        break;
      }
      case "--rescore":
        options.rescore = next();
        break;
      case "--stored":
        options.stored = true;
        break;
      default:
        fail(`Unknown option "${flag}". See the comment at the top of scripts/score-extractions.ts.`);
    }
  }

  return options;
}

async function loadReviewedBaselines(): Promise<Baseline[]> {
  const mongoUri = process.env.MONGODB_URI ?? fail("MONGODB_URI is not set. Run through npm run score.");
  const client = new MongoClient(mongoUri, { readPreference: "secondaryPreferred" });

  try {
    await client.connect();

    // find() only: the script never writes to the database.
    const documents = await client
      .db()
      .collection<Document>(COLLECTION_NAME)
      .find({ "comparison.baselineSubmissionId": { $exists: false }, reviewStatus: "reviewed" })
      .sort({ createdAt: 1 })
      .toArray();

    return documents.map((document) => {
      const extraction = document.extraction as ExtractionSnapshot;
      const review = document.review as SubmissionHumanReview;

      return {
        extraction,
        intake: document.intake as SubmissionIntakeSnapshot,
        review: normalizeSubmissionReview(extraction, {
          ...review,
          reviewerNotes: review.reviewerNotes ?? "",
        }),
        submissionId: String(document._id),
      };
    });
  } finally {
    await client.close();
  }
}

/** The PDF the baseline was extracted from, read from R2 only. */
async function loadPdf(intake: SubmissionIntakeSnapshot) {
  const source = intake.sourceMeta;

  if (source.kind === "upload") {
    if (!hasRetainedUploadSource(source)) {
      return { reason: "The upload was not retained." } as const;
    }

    return {
      bytes: await downloadObjectBytes(source.objectKey),
      fileName: normalizePdfFileName(source.fileName),
    } as const;
  }

  const exact = source.contentSha256
    ? await readCachedUrlSourcePdf(source.normalizedUrl, source.contentSha256)
    : null;
  const copy = exact ?? (await readCachedUrlSourcePdf(source.normalizedUrl, null));

  return copy
    ? ({ bytes: copy.bytes, fileName: normalizePdfFileName(source.pdfFileName) } as const)
    : ({ reason: "No cached copy of the vendor PDF." } as const);
}

async function scoreSheet(
  baseline: Baseline,
  options: Options,
  settings: { model: string; reasoningEffort: string } | null,
): Promise<SheetResult> {
  const base = {
    category: baseline.intake.packageCategory,
    partNumber: baseline.intake.partNumber,
    submissionId: baseline.submissionId,
  };

  if (options.stored || !settings) {
    return {
      ...base,
      costUsd: baseline.extraction.providerMeta.estimatedCostUsd ?? null,
      eval: evaluateExtraction(baseline, baseline.extraction),
      latencyMs: baseline.extraction.providerMeta.latencyMs ?? null,
      status: "scored",
    };
  }

  try {
    const pdf = await loadPdf(baseline.intake);

    if ("reason" in pdf) {
      return { ...base, costUsd: null, error: pdf.reason, latencyMs: null, status: "skipped" };
    }

    const result = await extractDatasheet({
      model: settings.model as Parameters<typeof extractDatasheet>[0]["model"],
      packageCategory: baseline.intake.packageCategory,
      partNumber: baseline.intake.partNumber,
      pdfBytes: pdf.bytes,
      pdfFileName: pdf.fileName,
      promptVersion: options.promptVersion,
      reasoningEffort: settings.reasoningEffort as Parameters<typeof extractDatasheet>[0]["reasoningEffort"],
      requestedFields: baseline.intake.requestedFields,
      sourceLabel: baseline.intake.sourceLabel,
    });
    const candidate = buildExtractionSnapshot(result);

    return {
      ...base,
      candidate,
      costUsd: candidate.providerMeta.estimatedCostUsd ?? null,
      eval: evaluateExtraction(baseline, candidate),
      latencyMs: candidate.providerMeta.latencyMs ?? null,
      status: "scored",
    };
  } catch (error) {
    return {
      ...base,
      costUsd: null,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: null,
      status: "failed",
    };
  }
}

async function runPool<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;

        results[index] = await work(items[index]);
      }
    }),
  );

  return results;
}

function percent(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

function describeTally(tally: EvalTally) {
  return `${tally.right}/${tally.total} right${tally.partial ? `, ${tally.partial} partial` : ""}${
    tally.missing ? `, ${tally.missing} missing` : ""
  }`;
}

function pad(text: string, width: number) {
  return text.length >= width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

function summarize(run: RunFile) {
  const scored = run.sheets.filter((sheet) => sheet.status === "scored" && sheet.eval);
  const measurements = sumTallies(scored.map((sheet) => sheet.eval!.measurements));
  const pins = sumTallies(scored.map((sheet) => sheet.eval!.pins));
  const cost = scored.reduce((sum, sheet) => sum + (sheet.costUsd ?? 0), 0);
  const twoTerminal = scored.filter((sheet) =>
    getTwoTerminalKind(sheet.category as SubmissionIntakeSnapshot["packageCategory"]),
  );
  const twoTerminalWithPins = twoTerminal.filter(
    (sheet) => (sheet.candidate?.pinRows.length ?? 0) >= 2,
  );

  return { cost, measurements, pins, scored, twoTerminal, twoTerminalWithPins };
}

function printRun(run: RunFile) {
  console.log(`\n${run.label}\n`);
  console.log(`${pad("Part", 26)}${pad("Category", 30)}${pad("Measurements", 30)}Pins`);

  for (const sheet of run.sheets) {
    if (sheet.status !== "scored" || !sheet.eval) {
      console.log(`${pad(sheet.partNumber, 26)}${pad(sheet.category, 30)}${sheet.status}: ${sheet.error ?? ""}`);
      continue;
    }

    console.log(
      `${pad(sheet.partNumber, 26)}${pad(sheet.category, 30)}${pad(describeTally(sheet.eval.measurements), 30)}${describeTally(sheet.eval.pins)}`,
    );
  }

  const { cost, measurements, pins, scored, twoTerminal, twoTerminalWithPins } = summarize(run);

  console.log(
    `\nMeasurements: ${measurements.right} of ${measurements.total} right (${percent(measurements.right, measurements.total)}), ${measurements.partial} partial`,
  );
  console.log(
    `Pins: ${pins.right} of ${pins.total} right (${percent(pins.right, pins.total)}), ${pins.partial} differ only in formatting, ${pins.missing} missing`,
  );

  if (!run.settings.stored) {
    console.log(
      `Two-terminal datasheets with pins: ${twoTerminalWithPins.length} of ${twoTerminal.length}`,
    );
  }

  console.log(`Datasheets scored: ${scored.length} of ${run.sheets.length}. Cost: $${cost.toFixed(2)}`);
}

function readRun(file: string): RunFile {
  return JSON.parse(readFileSync(file, "utf8")) as RunFile;
}

function printComparison(leftFile: string, rightFile: string) {
  const left = readRun(leftFile);
  const right = readRun(rightFile);
  const rightById = new Map(right.sheets.map((sheet) => [sheet.submissionId, sheet]));
  const pairs = left.sheets.flatMap((sheet) => {
    const other = rightById.get(sheet.submissionId);

    return sheet.status === "scored" && sheet.eval && other?.status === "scored" && other.eval
      ? [{ left: sheet, right: other }]
      : [];
  });

  console.log(`\nA: ${left.label}\nB: ${right.label}\nDatasheets scored by both: ${pairs.length}\n`);
  console.log(`${pad("Part", 26)}${pad("Measurements right A → B", 28)}Pins right A → B`);

  for (const { left: a, right: b } of pairs) {
    const measurementDelta = b.eval!.measurements.right - a.eval!.measurements.right;
    const pinDelta = b.eval!.pins.right - a.eval!.pins.right;
    const mark = (delta: number) => (delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : "");

    console.log(
      `${pad(a.partNumber, 26)}${pad(
        `${a.eval!.measurements.right} → ${b.eval!.measurements.right} of ${a.eval!.measurements.total}${mark(measurementDelta)}`,
        28,
      )}${a.eval!.pins.right} → ${b.eval!.pins.right} of ${a.eval!.pins.total}${mark(pinDelta)}`,
    );
  }

  const total = (side: "left" | "right", kind: "measurements" | "pins") =>
    sumTallies(pairs.map((pair) => pair[side].eval![kind]));

  for (const kind of ["measurements", "pins"] as const) {
    const a = total("left", kind);
    const b = total("right", kind);

    console.log(
      `\n${kind === "measurements" ? "Measurements" : "Pins"}: A ${a.right}/${a.total} right (${percent(a.right, a.total)}), ${a.partial} partial · B ${b.right}/${b.total} right (${percent(b.right, b.total)}), ${b.partial} partial`,
    );
  }
}

const options = readOptions(process.argv.slice(2));

if (options.compare) {
  printComparison(...options.compare);
  process.exit(0);
}

if (options.rescore) {
  // Scores the saved answers again against today's reviews, with no AI calls.
  const saved = readRun(options.rescore);
  const baselinesById = new Map((await loadReviewedBaselines()).map((baseline) => [baseline.submissionId, baseline]));
  const sheets = saved.sheets.map((sheet): SheetResult => {
    const baseline = baselinesById.get(sheet.submissionId);
    const candidate = sheet.candidate ?? (saved.settings.stored ? baseline?.extraction : undefined);

    return baseline && candidate && sheet.status === "scored"
      ? { ...sheet, eval: evaluateExtraction(baseline, candidate) }
      : sheet;
  });
  const run: RunFile = { ...saved, label: `${saved.label} (rescored)`, sheets };
  const outFile = options.out ?? options.rescore.replace(/\.json$/, "-rescored.json");

  writeFileSync(outFile, `${JSON.stringify(run, null, 2)}\n`);
  printRun(run);
  console.log(`\nSaved ${outFile}`);
  process.exit(0);
}

const settings = options.stored
  ? null
  : resolveExtractionSettings({ model: options.model, reasoningEffort: options.effort });

if (settings && !process.env.OPENAI_API_KEY) {
  fail("OPENAI_API_KEY is not set. Run through npm run score, which reads .env.local.");
}

let baselines = await loadReviewedBaselines();

if (!options.includeDoubtful) {
  baselines = baselines.filter((baseline) => !DOUBTFUL_PARTS.has(baseline.intake.partNumber));
}

if (options.parts.length > 0) {
  const wanted = new Set(options.parts.map((part) => part.toLowerCase()));

  baselines = baselines.filter((baseline) => wanted.has(baseline.intake.partNumber.toLowerCase()));
}

if (options.limit !== null) {
  baselines = baselines.slice(0, options.limit);
}

const label = options.stored
  ? "Stored extractions, as the reviewers saw them"
  : `Prompt ${options.promptVersion} · ${settings!.model} · ${settings!.reasoningEffort}`;

console.log(`${label}: ${baselines.length} reviewed datasheets${options.stored ? "" : `, ${options.concurrency} at a time`}.`);

let finished = 0;
const sheets = await runPool(baselines, options.concurrency, async (baseline) => {
  const result = await scoreSheet(baseline, options, settings);

  finished += 1;

  if (!options.stored) {
    console.log(`  ${finished}/${baselines.length} ${baseline.intake.partNumber}: ${result.status}${result.error ? ` (${result.error})` : ""}`);
  }

  return result;
});
const run: RunFile = {
  createdAt: new Date().toISOString(),
  label,
  settings: {
    model: settings?.model ?? null,
    promptVersion: options.stored ? null : options.promptVersion,
    reasoningEffort: settings?.reasoningEffort ?? null,
    stored: options.stored,
  },
  sheets,
};
const outFile =
  options.out ??
  path.join(
    EVAL_DIRECTORY,
    `${options.stored ? "stored" : `${options.promptVersion}-${settings!.model}-${settings!.reasoningEffort}`}-${run.createdAt.replace(/[:.]/g, "-")}.json`,
  );

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(run, null, 2)}\n`);
printRun(run);
console.log(`\nSaved ${outFile}`);
