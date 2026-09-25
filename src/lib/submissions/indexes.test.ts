import type { IndexDescription } from "mongodb";
import { describe, expect, it } from "vitest";

import { ensureSubmissionIndexes, SUBMISSION_INDEXES } from "./indexes";

function indexNamed(name: string) {
  const index = SUBMISSION_INDEXES.find((entry) => entry.name === name);

  if (!index) {
    throw new Error(`Missing index ${name}`);
  }

  return index;
}

describe("SUBMISSION_INDEXES", () => {
  it("has unique names", () => {
    const names = SUBMISSION_INDEXES.map((index) => index.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("serves the pending-baseline queue with its sort", () => {
    const queue = indexNamed("baseline_queue");

    // Equality on reviewStatus first, then the findNextPendingBaseline sort.
    expect(Object.keys(queue.key)).toEqual(["reviewStatus", "createdAt", "_id"]);
    // The queue queries always filter reviewStatus: "pending", so the partial
    // index is eligible for them.
    expect(queue.partialFilterExpression).toEqual({ reviewStatus: "pending" });
  });

  it("serves run lookups by baseline sorted by creation time", () => {
    expect(Object.keys(indexNamed("runs_by_baseline").key)).toEqual([
      "comparison.baselineSubmissionId",
      "createdAt",
    ]);
  });

  it("is only applied through an explicit call", async () => {
    const calls: IndexDescription[][] = [];
    const names = await ensureSubmissionIndexes({
      createIndexes: async (specs: IndexDescription[]) => {
        calls.push(specs);
        return specs.map((spec) => spec.name ?? "");
      },
    });

    expect(calls).toHaveLength(1);
    expect(names).toEqual(["baseline_queue", "runs_by_baseline", "created_desc"]);
  });
});
