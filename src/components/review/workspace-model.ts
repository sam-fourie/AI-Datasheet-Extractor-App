/**
 * Pure display helpers for the review workspace shell (header, toolbar,
 * datasheet pane, banners). Review rules stay in src/lib/submissions; these
 * only derive labels and counts from them. Client-safe.
 */

import { getOpenAIModelDefinition } from "@/lib/ai/models";
import {
  formatModelShortLabel,
  formatReasoningEffortLabel,
  formatRunLabel,
} from "@/lib/ai/provider-meta";
import type { ProviderMeta } from "@/lib/package-categories";
import { isScoredAgreement } from "@/lib/submissions/agreement";
import { getPackageEvidencePage, normalizeEvidencePages } from "@/lib/submissions/evidence";
import {
  classifyRowAttention,
  countReviewDecisions,
  getRowDecision,
  listReviewRowRefs,
  rowKeyOf,
  setDecision,
  type AttentionContext,
  type AttentionReason,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import { matchesReviewFilter, type ReviewFilter } from "@/lib/submissions/review-filters";
import type {
  ExtractionSnapshot,
  SubmissionAgreement,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionModelRun,
} from "@/lib/submissions/types";

/* ------------------------------- Labels ----------------------------------- */

/** "GPT-5.6 Sol" (catalog label), or the raw id for unknown models. */
export function formatModelName(model: string) {
  return getOpenAIModelDefinition(model)?.label ?? model;
}

/** "GPT-5.4 High" for meta lines; just the model when no effort was stored. */
export function formatModelWithEffort(providerMeta: Pick<ProviderMeta, "model" | "reasoningEffort">) {
  const effort = providerMeta.reasoningEffort?.trim();

  return effort
    ? `${formatModelName(providerMeta.model)} ${formatReasoningEffortLabel(effort)}`
    : formatModelName(providerMeta.model);
}

/** "GPT-5.6 Sol · High" for the run switcher trigger. */
export function formatModelDotEffort(providerMeta: Pick<ProviderMeta, "model" | "reasoningEffort">) {
  const effort = providerMeta.reasoningEffort?.trim();

  return effort
    ? `${formatModelName(providerMeta.model)} · ${formatReasoningEffortLabel(effort)}`
    : formatModelName(providerMeta.model);
}

/** Page title: "NE555DR review" or "NE555DR · Sol High run". */
export function formatReviewPageTitle(
  submission: Pick<SubmissionDetail, "comparison" | "intake" | "providerMeta">,
) {
  const partNumber = submission.intake.partNumber;

  if (!submission.comparison) {
    return `${partNumber} review`;
  }

  const effort = submission.providerMeta.reasoningEffort?.trim();
  const run = effort
    ? `${formatModelShortLabel(submission.providerMeta.model)} ${formatReasoningEffortLabel(effort)}`
    : formatModelShortLabel(submission.providerMeta.model);

  return `${partNumber} · ${run} run`;
}

/** The first part of a background task label: "Sol · High" -> "Sol". */
export function shortTaskName(label: string) {
  return label.split(" · ")[0] ?? label;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/* ------------------------------ Agreement ---------------------------------- */

/** Agreement text for switcher rows and toasts: coloured only when scored (addendum C). */
export function describeRunAgreement(agreement: SubmissionAgreement | null | undefined): {
  scored: boolean;
  text: string | null;
  value: number | null;
} {
  if (!agreement) {
    return { scored: false, text: null, value: null };
  }

  if (isScoredAgreement(agreement)) {
    return {
      scored: true,
      text: `${Math.round(agreement.agreementPercentage)}% agreement`,
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

/** Runs other than the baseline (the "N runs" count). */
export function countReruns(runs: readonly SubmissionModelRun[]) {
  return runs.filter((run) => !run.isBaseline).length;
}

/** "Already run · 84%" lookups for the re-run dialog: model|effort -> best label. */
export function indexRunsByModelEffort(runs: readonly SubmissionModelRun[]) {
  const map = new Map<string, { isBaseline: boolean; label: string }>();

  for (const run of runs) {
    const key = `${run.providerMeta.model}|${run.providerMeta.reasoningEffort ?? ""}`;

    if (run.isBaseline) {
      map.set(key, { isBaseline: true, label: "Baseline" });
      continue;
    }

    if (map.has(key)) {
      continue;
    }

    const agreement = describeRunAgreement(run.agreement);

    map.set(key, {
      isBaseline: false,
      label: agreement.scored ? `Already run · ${Math.round(agreement.value ?? 0)}%` : "Already run",
    });
  }

  return map;
}

/* ----------------------------- Row evidence -------------------------------- */

/** The pages the datasheet can show for a row (the first one is where it opens). */
export function getRowEvidencePages(extraction: ExtractionSnapshot, ref: ReviewRowRef): number[] {
  switch (ref.kind) {
    case "package": {
      const page = getPackageEvidencePage(extraction);

      return page === null ? [] : [page];
    }
    case "measurement":
      return normalizeEvidencePages(
        extraction.fields.find((field) => field.field === ref.field)?.evidencePages,
      );
    case "pin":
      return normalizeEvidencePages(extraction.pinRows[ref.pinIndex]?.evidencePages);
  }
}

/** Short row label for the pane context line: "Package", "Body Length", "Pin 8, VCC". */
export function describeRowShort(extraction: ExtractionSnapshot, ref: ReviewRowRef): string {
  switch (ref.kind) {
    case "package":
      return "Package";
    case "measurement":
      return ref.field;
    case "pin": {
      const pin = extraction.pinRows[ref.pinIndex];

      return pin ? `Pin ${pin.pinNumber}, ${pin.pinName}` : "Pin";
    }
  }
}

/* ------------------------------- Counts ------------------------------------ */

export type FilterCounts = Record<ReviewFilter, number>;

/** Counts for the filter menu, from the draft (§5.6). */
export function countFilters(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  contextFor: (ref: ReviewRowRef) => AttentionContext,
): FilterCounts {
  const counts: FilterCounts = {
    all: 0,
    attention: 0,
    differs: 0,
    incorrect: 0,
    pending: 0,
    runsDisagree: 0,
  };

  for (const ref of listReviewRowRefs(extraction)) {
    const context = contextFor(ref);

    counts.all += 1;

    for (const filter of ["pending", "attention", "incorrect", "differs", "runsDisagree"] as const) {
      if (matchesReviewFilter(filter, extraction, review, ref, context)) {
        counts[filter] += 1;
      }
    }
  }

  return counts;
}

const AI_FLAG_REASONS: readonly AttentionReason[] = [
  "lowConfidence",
  "mediumConfidence",
  "aiUnsure",
  "notFound",
  "needsReview",
];

/** Numbers for the arrival banner (addendum A), all from the submission itself. */
export function computeArrivalStats(submission: Pick<SubmissionDetail, "extraction">) {
  const { extraction } = submission;
  const latencyMs = extraction.providerMeta.latencyMs;
  let flagged = 0;

  for (const ref of listReviewRowRefs(extraction)) {
    const reasons = classifyRowAttention(extraction, ref);

    if (reasons.some((reason) => AI_FLAG_REASONS.includes(reason))) {
      flagged += 1;
    }
  }

  return {
    flagged,
    latencyMs: typeof latencyMs === "number" && Number.isFinite(latencyMs) ? latencyMs : null,
    measurements: extraction.fields.length,
    pins: extraction.pinRows.length,
  };
}

/** "84% accurate · 16 confirmed · 3 corrected" for the completion card and toast. */
export function describeCompletion(review: SubmissionHumanReview) {
  const counts = countReviewDecisions(review);
  const accuracy = counts.total > 0 ? Math.round((counts.confirmed / counts.total) * 100) : null;

  return {
    accuracy,
    counts,
    summary: [
      accuracy === null ? null : `${accuracy}% accurate`,
      `${counts.confirmed} confirmed`,
      `${counts.corrected} corrected`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export type CompletionState = { summary: string; title: string };

/**
 * The completion card after a later save (one that did not itself complete the
 * review): kept with a recomputed summary while the saved review is fully
 * decided, dropped once any row is pending again.
 */
export function refreshCompletion(
  current: CompletionState | null,
  savedReview: SubmissionHumanReview,
): CompletionState | null {
  if (!current || countReviewDecisions(savedReview).pending > 0) {
    return null;
  }

  return { ...current, summary: describeCompletion(savedReview).summary };
}

/* ------------------------------- Bulk undo --------------------------------- */

/** The rows bulkConfirm(review, refs) changes: each distinct ref that is pending in `review`. */
export function listBulkConfirmChanges(
  review: SubmissionHumanReview,
  refs: readonly ReviewRowRef[],
): ReviewRowRef[] {
  const seen = new Set<string>();

  return refs.filter((ref) => {
    const key = rowKeyOf(ref);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return getRowDecision(review, ref) === "pending";
  });
}

/**
 * The bulk toast's Undo: the rows a bulk confirm changed go back to pending
 * when they are still confirmed. Rows decided differently since, and every
 * other edit made after the bulk action, stay as they are.
 */
export function revertBulkConfirm(
  review: SubmissionHumanReview,
  changedRefs: readonly ReviewRowRef[],
): SubmissionHumanReview {
  let next = review;

  for (const ref of changedRefs) {
    if (getRowDecision(next, ref) === "confirmed") {
      next = setDecision(next, ref, "pending");
    }
  }

  return next;
}

/* ------------------------------- Run label --------------------------------- */

export { formatRunLabel };
