import type { MeasurementFieldRow, PinRow } from "@/lib/package-categories";
import {
  buildSubmissionResolvedView,
  countReviewDecisions,
  deriveSubmissionReviewStatus,
  getRowDecision,
  measurementRowKey,
  PACKAGE_ROW_KEY,
  pinRowKey,
  rowKeyOf,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import type {
  AgreementOutcome,
  BaselineRunHint,
  BaselineRunHints,
  SubmissionModelRun,
  ExtractionSnapshot,
  ResolvedMeasurementRow,
  ResolvedPinRow,
  SubmissionAgreement,
  SubmissionAgreementRow,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

/**
 * Compares a re-run extraction against a baseline submission.
 *
 * Once the baseline has confirmed or corrected decisions, only those rows are
 * compared and the resolved (human-reviewed) values are the reference. Until
 * then every row is compared against the baseline's raw AI output so two
 * models can still be checked for consistency.
 *
 * Measurement values are free text, so numeric agreement is used: the same set
 * of numbers is a match, one side containing a subset of the other's numbers
 * is partial, anything else is a mismatch. Names use normalised identifiers.
 */

const NUMBER_PATTERN = /(?<![a-z])-?\d+(?:[.,]\d+)?/g;
const NUMBER_TOLERANCE = 1e-6;
const NOT_FOUND_LABEL = "Not found";
const MISSING_LABEL = "Missing";

type BaselineSubmission = {
  extraction: ExtractionSnapshot;
  review: SubmissionHumanReview;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0),
  );
}

function extractNumbers(value: string) {
  const numbers = Array.from(value.matchAll(NUMBER_PATTERN), (match) =>
    Number.parseFloat(match[0].replace(",", ".")),
  )
    .filter((number) => Number.isFinite(number))
    .sort((left, right) => left - right);
  const unique: number[] = [];

  for (const number of numbers) {
    const previous = unique.at(-1);

    if (previous === undefined || Math.abs(previous - number) > NUMBER_TOLERANCE) {
      unique.push(number);
    }
  }

  return unique;
}

function includesAllNumbers(haystack: number[], needles: number[]) {
  return needles.every((needle) =>
    haystack.some((candidate) => Math.abs(candidate - needle) <= NUMBER_TOLERANCE),
  );
}

function compareMeasurementText(
  baselineValue: string,
  rerunValue: string,
): AgreementOutcome {
  const baselineText = normalizeText(baselineValue);
  const rerunText = normalizeText(rerunValue);

  if (baselineText === rerunText) {
    return "match";
  }

  const baselineNumbers = extractNumbers(baselineText);
  const rerunNumbers = extractNumbers(rerunText);

  if (baselineNumbers.length > 0 && rerunNumbers.length > 0) {
    if (
      baselineNumbers.length === rerunNumbers.length &&
      includesAllNumbers(baselineNumbers, rerunNumbers)
    ) {
      return "match";
    }

    if (
      includesAllNumbers(baselineNumbers, rerunNumbers) ||
      includesAllNumbers(rerunNumbers, baselineNumbers)
    ) {
      return "partial";
    }

    return "mismatch";
  }

  return compareIdentifiers(baselineText, rerunText);
}

function compareIdentifiers(
  baselineValue: string,
  rerunValue: string,
): AgreementOutcome {
  const baselineIdentifier = normalizeIdentifier(baselineValue);
  const rerunIdentifier = normalizeIdentifier(rerunValue);

  if (baselineIdentifier.length === 0 || rerunIdentifier.length === 0) {
    return baselineIdentifier === rerunIdentifier ? "match" : "mismatch";
  }

  if (baselineIdentifier === rerunIdentifier) {
    return "match";
  }

  if (
    baselineIdentifier.includes(rerunIdentifier) ||
    rerunIdentifier.includes(baselineIdentifier)
  ) {
    return "partial";
  }

  const baselineTokens = tokenize(baselineValue);
  const rerunTokens = tokenize(rerunValue);
  const sharedTokens = Array.from(baselineTokens).filter((token) =>
    rerunTokens.has(token),
  ).length;
  const smallerTokenCount = Math.min(baselineTokens.size, rerunTokens.size);

  return smallerTokenCount > 0 && sharedTokens / smallerTokenCount >= 0.5
    ? "partial"
    : "mismatch";
}

function describeMeasurement(row: Pick<MeasurementFieldRow, "status" | "value">) {
  return row.status === "Not found" ? NOT_FOUND_LABEL : row.value;
}

// Row keys are defined in review.ts (so the review rules can use them without
// an import cycle) and re-exported here for agreement consumers.
export { measurementRowKey, PACKAGE_ROW_KEY, pinRowKey };

function compareMeasurementRow(
  baseline: ResolvedMeasurementRow,
  baselineIndex: number,
  rerun: { index: number; row: MeasurementFieldRow } | undefined,
): SubmissionAgreementRow {
  const baselineValue = describeMeasurement(baseline);
  const key = measurementRowKey(baseline.field);

  if (!rerun) {
    return {
      baselineIndex,
      baselineValue,
      key,
      kind: "measurement",
      label: baseline.field,
      outcome: "mismatch",
      rerunValue: MISSING_LABEL,
    };
  }

  const rerunValue = describeMeasurement(rerun.row);
  const baselineNotFound = baseline.status === "Not found";
  const rerunNotFound = rerun.row.status === "Not found";
  const outcome: AgreementOutcome =
    baselineNotFound || rerunNotFound
      ? baselineNotFound && rerunNotFound
        ? "match"
        : "mismatch"
      : compareMeasurementText(baseline.value, rerun.row.value);

  return {
    baselineIndex,
    baselineValue,
    key,
    kind: "measurement",
    label: baseline.field,
    outcome,
    rerunIndex: rerun.index,
    rerunValue,
  };
}

function comparePinRow(
  baseline: ResolvedPinRow,
  rerun: { index: number; row: PinRow } | undefined,
): SubmissionAgreementRow {
  return {
    baselineIndex: baseline.pinIndex,
    baselineValue: baseline.pinName,
    key: pinRowKey(baseline.pinIndex),
    kind: "pin",
    label: `Pin ${baseline.pinNumber}`,
    outcome: rerun ? compareIdentifiers(baseline.pinName, rerun.row.pinName) : "mismatch",
    ...(rerun ? { rerunIndex: rerun.index } : {}),
    rerunValue: rerun ? rerun.row.pinName : MISSING_LABEL,
  };
}

export function computeSubmissionAgreement(
  baseline: BaselineSubmission,
  rerunExtraction: ExtractionSnapshot,
): SubmissionAgreement {
  const resolved = buildSubmissionResolvedView(baseline);
  const decisionCounts = countReviewDecisions(baseline.review);
  const baselineReviewedDecisions = decisionCounts.confirmed + decisionCounts.corrected;
  const basis = baselineReviewedDecisions > 0 ? "reviewed" : "unreviewed";
  const includeRow = (reviewStatus: ResolvedMeasurementRow["reviewStatus"]) =>
    basis === "unreviewed" || reviewStatus !== "pending";
  const rerunFieldMap = new Map(
    rerunExtraction.fields.map(
      (field, index) => [field.field.toLowerCase(), { index, row: field }] as const,
    ),
  );
  const rerunPinMap = new Map<string, { index: number; row: PinRow }>();

  rerunExtraction.pinRows.forEach((pinRow, index) => {
    const key = normalizeIdentifier(pinRow.pinNumber);

    if (!rerunPinMap.has(key)) {
      rerunPinMap.set(key, { index, row: pinRow });
    }
  });

  const rows: SubmissionAgreementRow[] = [];

  if (includeRow(resolved.packageSelection.reviewStatus)) {
    rows.push({
      baselineValue: resolved.packageSelection.selectedPackage,
      key: PACKAGE_ROW_KEY,
      kind: "package",
      label: "Package",
      outcome: compareIdentifiers(
        resolved.packageSelection.selectedPackage,
        rerunExtraction.packageSelection.selectedPackage,
      ),
      rerunValue: rerunExtraction.packageSelection.selectedPackage,
    });
  }

  resolved.fields.forEach((field, index) => {
    if (includeRow(field.reviewStatus)) {
      rows.push(
        compareMeasurementRow(field, index, rerunFieldMap.get(field.field.toLowerCase())),
      );
    }
  });

  for (const pinRow of resolved.pinRows) {
    if (includeRow(pinRow.reviewStatus)) {
      rows.push(
        comparePinRow(pinRow, rerunPinMap.get(normalizeIdentifier(pinRow.pinNumber))),
      );
    }
  }

  const matches = rows.filter((row) => row.outcome === "match").length;
  const partialMatches = rows.filter((row) => row.outcome === "partial").length;
  const mismatches = rows.length - matches - partialMatches;

  return {
    agreementPercentage:
      rows.length > 0 ? Math.round((matches / rows.length) * 100) : null,
    basis,
    baselineReviewStatus: deriveSubmissionReviewStatus(baseline.review),
    baselineReviewedDecisions,
    baselineTotalDecisions: decisionCounts.total,
    compared: rows.length,
    matches,
    mismatches,
    partialMatches,
    rows,
  };
}

/**
 * True only when the agreement was scored against a FULLY reviewed baseline.
 * Use this wherever a coloured agreement score is shown or aggregated.
 */
export function isScoredAgreement(
  agreement: SubmissionAgreement | null | undefined,
): agreement is SubmissionAgreement & { agreementPercentage: number } {
  return (
    agreement !== null &&
    agreement !== undefined &&
    agreement.basis === "reviewed" &&
    agreement.baselineReviewStatus === "reviewed" &&
    agreement.agreementPercentage !== null
  );
}

/**
 * For a baseline page: per baseline row key, how the loaded re-runs compare on
 * that row. Every re-run with an agreement counts, scored or not (the hint
 * says how many runs). `differs` counts mismatches, `partial` partial matches.
 * Whether a hint flags the row is decided by runHintDisagrees in review.ts.
 */
export function buildBaselineRunHints(
  runs: readonly SubmissionModelRun[],
): BaselineRunHints {
  const hints: BaselineRunHints = {};

  for (const run of runs) {
    if (run.isBaseline || !run.agreement) {
      continue;
    }

    for (const row of run.agreement.rows) {
      const hint = (hints[row.key] ??= { differs: 0, partial: 0, runs: 0 });

      hint.runs += 1;

      if (row.outcome === "mismatch") {
        hint.differs += 1;
      } else if (row.outcome === "partial") {
        hint.partial += 1;
      }
    }
  }

  return hints;
}

/**
 * "2 of 4 runs differ": mismatching runs only (partial matches are not
 * counted), or null when no run mismatches. Shown only alongside the
 * runsDisagree attention reason (see runHintDisagrees).
 */
export function describeRunHint(hint: BaselineRunHint | null | undefined): string | null {
  if (!hint || hint.differs === 0) {
    return null;
  }

  return `${hint.differs} of ${hint.runs} ${hint.runs === 1 ? "run differs" : "runs differ"}`;
}

/* ----------------------- Re-run row mapping (review UI) ----------------------- */

/**
 * Maps an agreement row (keyed by BASELINE row) to the matching row of the
 * re-run extraction via `rerunIndex`. Null when the run has no such row.
 */
export function agreementRowToRerunRef(
  row: SubmissionAgreementRow,
  rerunExtraction: ExtractionSnapshot,
): ReviewRowRef | null {
  switch (row.kind) {
    case "package":
      return { kind: "package" };
    case "measurement": {
      const field =
        row.rerunIndex !== undefined ? rerunExtraction.fields[row.rerunIndex] : undefined;

      return field ? { field: field.field, kind: "measurement" } : null;
    }
    case "pin":
      return row.rerunIndex !== undefined && row.rerunIndex < rerunExtraction.pinRows.length
        ? { kind: "pin", pinIndex: row.rerunIndex }
        : null;
  }
}

/**
 * Agreement rows keyed by the RE-RUN's row key (rowKeyOf), so a re-run page
 * can look up each of its own rows' outcome. The first agreement row wins
 * when two baseline rows map to the same re-run row.
 */
export function indexAgreementRowsByRerunKey(
  agreement: SubmissionAgreement | null | undefined,
  rerunExtraction: ExtractionSnapshot,
): Map<string, SubmissionAgreementRow> {
  const byKey = new Map<string, SubmissionAgreementRow>();

  for (const row of agreement?.rows ?? []) {
    const ref = agreementRowToRerunRef(row, rerunExtraction);

    if (ref) {
      const key = rowKeyOf(ref);

      if (!byKey.has(key)) {
        byKey.set(key, row);
      }
    }
  }

  return byKey;
}

/** Baseline rows the run has no counterpart for ("Only in baseline: Pin 8"). */
export function listOnlyInBaselineRows(
  agreement: SubmissionAgreement | null | undefined,
  rerunExtraction: ExtractionSnapshot,
): SubmissionAgreementRow[] {
  return (agreement?.rows ?? []).filter(
    (row) => row.kind !== "package" && agreementRowToRerunRef(row, rerunExtraction) === null,
  );
}

/**
 * Re-run rows that match the baseline and are still pending: the scope of
 * "Confirm N matching the reviewed baseline". Partials are excluded. Only
 * offer it when isScoredAgreement(agreement) holds.
 */
export function listMatchingPendingRefs(
  agreement: SubmissionAgreement | null | undefined,
  rerunExtraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
): ReviewRowRef[] {
  const refs: ReviewRowRef[] = [];
  const seen = new Set<string>();

  for (const row of agreement?.rows ?? []) {
    if (row.outcome !== "match") {
      continue;
    }

    const ref = agreementRowToRerunRef(row, rerunExtraction);

    if (!ref) {
      continue;
    }

    const key = rowKeyOf(ref);

    if (!seen.has(key) && getRowDecision(review, ref) === "pending") {
      seen.add(key);
      refs.push(ref);
    }
  }

  return refs;
}

/**
 * Whether an agreement is shown as a coloured score or as neutral text
 * (addendum C). `scored` is isScoredAgreement(agreement); when false, show
 * `text` in neutral grey.
 */
export function describeAgreementBasis(
  agreement: SubmissionAgreement | null | undefined,
  options: { baselineMissing?: boolean } = {},
): { scored: boolean; text: string; value: number | null } {
  if (options.baselineMissing) {
    return { scored: false, text: "Baseline deleted", value: null };
  }

  if (!agreement) {
    return { scored: false, text: "Not scored", value: null };
  }

  if (isScoredAgreement(agreement)) {
    return {
      scored: true,
      text: `${agreement.agreementPercentage}% agreement`,
      value: agreement.agreementPercentage,
    };
  }

  if (agreement.basis === "unreviewed") {
    return { scored: false, text: "vs unreviewed baseline", value: agreement.agreementPercentage };
  }

  return {
    scored: false,
    text: `vs partly reviewed baseline (${agreement.baselineReviewedDecisions} of ${agreement.baselineTotalDecisions})`,
    value: agreement.agreementPercentage,
  };
}
