import type { OpenAIModelId, OpenAIReasoningEffort } from "@/lib/ai/models";
import { formatUsd } from "@/lib/ai/provider-meta";
import type { ExtractionErrorCode } from "@/lib/extractions";
import { formatBytes } from "@/lib/format";
import type { PackageCategory } from "@/lib/package-categories";
import { MAX_PDF_BYTES, PDF_MIME_TYPE } from "@/lib/pdf";

/**
 * Client-safe helpers and types shared by the intake components. Nothing in
 * here touches the network or React.
 */

/** Slim per-model benchmark passed from the server page (from summarizeModelRuns). */
export type ModelRunEstimate = {
  averageCostUsd: number | null;
  medianLatencyMs: number | null;
  model: string;
  p90LatencyMs: number | null;
  reasoningEffort: string | null;
  runs: number;
};

export type SourceKind = "upload" | "url";

export type ExtractionSourceInput =
  | { file: File; kind: "upload" }
  | { kind: "url"; url: string };

export type ExtractionRequestInput = {
  model: OpenAIModelId;
  packageCategory: PackageCategory;
  partNumber: string;
  reasoningEffort: OpenAIReasoningEffort;
  source: ExtractionSourceInput;
};

export type ExtractionFailure = {
  code: Exclude<ExtractionErrorCode, "cancelled">;
  /** Raw message from the server or the browser, for the "Details" disclosure. */
  message: string;
};

export const REVIEW_ARRIVAL_KEY_PREFIX = "review:arrival:";

/** Name + size + lastModified: the identity used to reuse an uploaded payload (addendum T). */
export function getFileIdentity(file: File) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function isPdfFile(file: File) {
  return file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith(".pdf");
}

export function getFileValidationError(file: File | null) {
  if (!file) {
    return null;
  }

  if (!isPdfFile(file)) {
    return "Choose a PDF file.";
  }

  if (file.size > MAX_PDF_BYTES) {
    return `That PDF is over ${formatBytes(MAX_PDF_BYTES)}. Compress it or upload a smaller copy.`;
  }

  return null;
}

export function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const FILE_NAME_NOISE =
  /^(datasheet|data|sheet|ds|rev[a-z0-9]*|v\d+|en|us|final|pdf|spec|product|preview)$/i;

/**
 * A part number guess from a file name, e.g. "TPS62130-datasheet.pdf" ->
 * "TPS62130". Case is kept exactly as written. Returns null when nothing in
 * the name looks like a part number (letters and digits, 3+ characters).
 */
export function suggestPartNumberFromFileName(fileName: string | null | undefined) {
  if (!fileName) {
    return null;
  }

  const base = fileName
    .split(/[\\/]/)
    .at(-1)!
    .replace(/\.pdf$/i, "")
    .trim();
  const tokens = base.split(/[\s_]+|-(?=[a-z]*(?:datasheet|ds|rev))/i).filter(Boolean);

  for (const token of tokens) {
    const candidate = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");

    if (
      candidate.length >= 3 &&
      candidate.length <= 40 &&
      /[A-Za-z]/.test(candidate) &&
      /\d/.test(candidate) &&
      !FILE_NAME_NOISE.test(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

export function findModelEstimate(
  estimates: readonly ModelRunEstimate[] | null,
  model: string,
  reasoningEffort: string,
) {
  return (
    estimates?.find(
      (estimate) =>
        estimate.model === model && estimate.reasoningEffort === reasoningEffort,
    ) ?? null
  );
}

/**
 * Seconds the whole request usually takes: the model's median latency plus
 * ~3 s for the upload hand-off and saving (spec §2.2).
 */
export function estimateSeconds(estimate: ModelRunEstimate | null) {
  if (!estimate || estimate.medianLatencyMs === null) {
    return null;
  }

  return Math.round(estimate.medianLatencyMs / 1000) + 3;
}

/** "~20 s · ~$0.220 per datasheet", "No runs yet", or null when benchmarks failed to load. */
export function describeModelEstimate(
  estimates: readonly ModelRunEstimate[] | null,
  model: string,
  reasoningEffort: string,
) {
  if (estimates === null) {
    return null;
  }

  const estimate = findModelEstimate(estimates, model, reasoningEffort);
  const seconds = estimateSeconds(estimate);
  const parts = [
    seconds !== null ? `~${seconds} s` : null,
    estimate?.averageCostUsd != null ? `~${formatUsd(estimate.averageCostUsd)}` : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return "No runs yet";
  }

  return `${parts.join(" · ")} per datasheet`;
}

/** Threshold for "Taking longer than usual": max(p90, 60 s). */
export function getSlowThresholdMs(estimate: ModelRunEstimate | null) {
  return Math.max(estimate?.p90LatencyMs ?? 0, 60_000);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
