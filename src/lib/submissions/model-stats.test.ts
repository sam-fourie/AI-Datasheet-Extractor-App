import { describe, expect, it } from "vitest";

import { percentile, summarizeModelRuns, type ModelRunInput } from "@/lib/submissions/model-stats";
import type { SubmissionAgreement } from "@/lib/submissions/types";

function agreement(
  agreementPercentage: number,
  overrides: Partial<SubmissionAgreement> = {},
): SubmissionAgreement {
  return {
    agreementPercentage,
    basis: "reviewed",
    baselineReviewStatus: "reviewed",
    baselineReviewedDecisions: 10,
    baselineTotalDecisions: 10,
    compared: 10,
    matches: 0,
    mismatches: 0,
    partialMatches: 0,
    rows: [],
    ...overrides,
  };
}

function run(
  latencyMs: number | undefined,
  overrides: Partial<ModelRunInput> = {},
): ModelRunInput {
  return {
    providerMeta: {
      latencyMs,
      model: "gpt-5.6-terra",
      provider: "openai",
      reasoningEffort: "high",
    },
    reviewDecisionCounts: { confirmed: 0, corrected: 0, pending: 1, total: 1 },
    reviewStatus: "pending",
    ...overrides,
  };
}

describe("percentile", () => {
  it("interpolates between ranks", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.9)).toBeCloseTo(91);
    expect(percentile([42], 0.9)).toBe(42);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("summarizeModelRuns latency", () => {
  it("reports median and p90 over runs with latency data only", () => {
    const [stats] = summarizeModelRuns([
      run(10_000),
      run(40_000),
      run(20_000),
      run(30_000),
      run(undefined),
    ]);

    expect(stats.runs).toBe(5);
    expect(stats.latencyRuns).toBe(4);
    expect(stats.medianLatencyMs).toBe(25_000);
    expect(stats.p90LatencyMs).toBe(37_000);
    expect(stats.averageLatencyMs).toBe(25_000);
  });

  it("is null without latency data", () => {
    const [stats] = summarizeModelRuns([run(undefined)]);

    expect(stats.medianLatencyMs).toBeNull();
    expect(stats.p90LatencyMs).toBeNull();
  });
});

describe("summarizeModelRuns agreement", () => {
  it("averages only scored agreement", () => {
    const comparison = (value: SubmissionAgreement) => ({
      agreement: value,
      baseline: null,
      baselineSubmissionId: "b",
    });
    const [stats] = summarizeModelRuns([
      run(1_000, { comparison: comparison(agreement(90)) }),
      run(1_000, { comparison: comparison(agreement(70)) }),
      run(1_000, { comparison: comparison(agreement(10, { basis: "unreviewed" })) }),
      run(1_000, { comparison: comparison(agreement(10, { baselineReviewStatus: "pending" })) }),
    ]);

    expect(stats.agreementRuns).toBe(2);
    expect(stats.averageAgreement).toBe(80);
    expect(stats.rerunRuns).toBe(4);
    expect(stats.baselineRuns).toBe(0);
  });

  it("averages accuracy over reviewed submissions", () => {
    const [stats] = summarizeModelRuns([
      run(1_000, {
        reviewDecisionCounts: { confirmed: 9, corrected: 1, pending: 0, total: 10 },
        reviewStatus: "reviewed",
      }),
      run(1_000, {
        reviewDecisionCounts: { confirmed: 7, corrected: 3, pending: 0, total: 10 },
        reviewStatus: "reviewed",
      }),
      run(1_000),
    ]);

    expect(stats.reviewedRuns).toBe(2);
    expect(stats.averageAccuracy).toBe(80);
  });
});
