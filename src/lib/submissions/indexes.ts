import type { Collection, Document, IndexDescription } from "mongodb";

/**
 * Indexes for `datasheet_submissions`, matched to the hot read paths:
 *
 * - `baseline_queue`: getReviewQueueCount (sidebar badge on every load) and
 *   findNextPendingBaseline (sorted by createdAt, _id). Partial on pending so
 *   it stays small; `comparison: { $exists: false }` is applied as a residual
 *   filter because a partial index cannot express `$exists: false`.
 * - `runs_by_baseline`: listSubmissionModelRuns and every other lookup by
 *   `comparison.baselineSubmissionId` (list grouping, delete-with-runs).
 * - `created_desc`: newest-first archive and reports scans.
 *
 * MONGODB_URI points at production, so these are never created implicitly
 * from a request path. A human applies them once, deliberately, by calling
 * `ensureSubmissionIndexes` from a one-off script. createIndexes is
 * idempotent when the name and options match.
 */
export const SUBMISSION_INDEXES: readonly IndexDescription[] = [
  {
    key: { reviewStatus: 1, createdAt: 1, _id: 1 },
    name: "baseline_queue",
    partialFilterExpression: { reviewStatus: "pending" },
  },
  {
    key: { "comparison.baselineSubmissionId": 1, createdAt: 1 },
    name: "runs_by_baseline",
  },
  {
    key: { createdAt: -1 },
    name: "created_desc",
  },
];

export async function ensureSubmissionIndexes<T extends Document>(
  collection: Pick<Collection<T>, "createIndexes">,
): Promise<string[]> {
  return collection.createIndexes([...SUBMISSION_INDEXES]);
}
