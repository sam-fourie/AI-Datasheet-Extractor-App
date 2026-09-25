import { serializeDatasheetListQuery } from "@/lib/submissions/list-query";
import type {
  DatasheetGroup,
  DatasheetListQuery,
  SubmissionListRun,
} from "@/lib/submissions/types";

/*
 * Display helpers for the /submissions list. Client-safe: no server imports.
 * Review and agreement rules stay in src/lib; these only format.
 */

export const SUBMISSIONS_PATH = "/submissions";

/** sessionStorage key the review page reads to rebuild its back link. */
export const LAST_QUERY_STORAGE_KEY = "submissions:lastQuery";

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "/submissions" or "/submissions?q=…" for a (partial) list query. */
export function buildListHref(query: Partial<DatasheetListQuery>) {
  const search = serializeDatasheetListQuery(query);

  return search ? `${SUBMISSIONS_PATH}?${search}` : SUBMISSIONS_PATH;
}

export function buildReviewHref(submissionId: string) {
  return `${SUBMISSIONS_PATH}/${encodeURIComponent(submissionId)}`;
}

/** "13 submissions · 9 need review" (addendum B). Re-runs are never counted. */
export function formatListMeta(counts: { all: number; needsReview: number }) {
  const submissions = pluralize(counts.all, "submission");

  if (counts.all === 0) {
    return "No submissions yet";
  }

  if (counts.needsReview === 0) {
    return `${submissions} · all reviewed`;
  }

  return `${submissions} · ${counts.needsReview} ${counts.needsReview === 1 ? "needs" : "need"} review`;
}

/** "68–96% agreement", "84% agreement", or null without scored runs. */
export function formatAgreementRange(range: DatasheetGroup["scoredAgreementRange"]) {
  if (!range) {
    return null;
  }

  const min = Math.round(range.min);
  const max = Math.round(range.max);

  return min === max ? `${max}% agreement` : `${min}–${max}% agreement`;
}

/**
 * Neutral text for a run whose agreement is not a scored agreement
 * (addendum C). Null when the run has a scored agreement.
 */
export function describeUnscoredRun(run: SubmissionListRun): string | null {
  if (run.isScored && run.agreementPercentage !== null) {
    return null;
  }

  if (run.agreementBasis === "unreviewed") {
    return "vs unreviewed baseline";
  }

  if (run.agreementBasis === "reviewed") {
    const reviewed = run.baselineReviewedDecisions;
    const total = run.baselineTotalDecisions;

    return typeof reviewed === "number" && typeof total === "number"
      ? `vs partly reviewed baseline (${reviewed} of ${total})`
      : "vs partly reviewed baseline";
  }

  return "No agreement yet";
}

export function runRowId(groupId: string, runId: string) {
  return `run-row-${groupId}-${runId}`;
}

/** True when the list is already searching for exactly this part number. */
export function isSearchingForPart(query: DatasheetListQuery, partNumber: string) {
  return query.q.trim().toLowerCase() === partNumber.trim().toLowerCase();
}
