import { OPENAI_MODEL_IDS, OPENAI_REASONING_EFFORTS } from "@/lib/ai/models";
import { deriveSubmissionAccuracyPercentage } from "@/lib/submissions/review";
import type { SubmissionSummary } from "@/lib/submissions/types";

/**
 * Aggregates submissions per model and reasoning effort for the archive's
 * model performance table. Accuracy only counts reviewed submissions and
 * agreement only counts re-runs scored against a fully reviewed baseline, so
 * a baseline with a handful of confirmed rows cannot skew the average.
 */

export type ModelRunStats = {
  agreementRuns: number;
  averageAccuracy: number | null;
  averageAgreement: number | null;
  averageCostUsd: number | null;
  averageLatencyMs: number | null;
  baselineRuns: number;
  costRuns: number;
  key: string;
  latencyRuns: number;
  model: string;
  reasoningEffort: string | null;
  rerunRuns: number;
  reviewedRuns: number;
  runs: number;
  totalCostUsd: number | null;
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number | null, fractionDigits: number) {
  if (value === null) {
    return null;
  }

  const factor = 10 ** fractionDigits;

  return Math.round(value * factor) / factor;
}

function orderIndex(list: readonly string[], value: string | null) {
  if (value === null) {
    return -1;
  }

  const index = list.indexOf(value);

  return index === -1 ? list.length : index;
}

export function sortModelIds(modelIds: string[]) {
  return [...modelIds].sort(
    (left, right) =>
      orderIndex(OPENAI_MODEL_IDS, left) - orderIndex(OPENAI_MODEL_IDS, right) ||
      left.localeCompare(right),
  );
}

export function summarizeModelRuns(
  submissions: SubmissionSummary[],
): ModelRunStats[] {
  const groups = new Map<string, SubmissionSummary[]>();

  for (const submission of submissions) {
    const effort = submission.providerMeta.reasoningEffort ?? "";
    const key = `${submission.providerMeta.model}::${effort}`;
    const group = groups.get(key);

    if (group) {
      group.push(submission);
    } else {
      groups.set(key, [submission]);
    }
  }

  const stats = Array.from(groups, ([key, group]) => {
    const first = group[0];
    const accuracies = group
      .map((submission) => deriveSubmissionAccuracyPercentage(submission))
      .filter((value): value is number => value !== null);
    const agreements = group
      .map((submission) => submission.comparison?.agreement ?? null)
      .map((agreement) =>
        agreement &&
        agreement.basis === "reviewed" &&
        agreement.baselineReviewStatus === "reviewed"
          ? agreement.agreementPercentage
          : null,
      )
      .filter((value): value is number => value !== null);
    const latencies = group
      .map((submission) => submission.providerMeta.latencyMs)
      .filter((value): value is number => typeof value === "number");
    const costs = group
      .map((submission) => submission.providerMeta.estimatedCostUsd)
      .filter((value): value is number => typeof value === "number");
    const rerunRuns = group.filter((submission) => Boolean(submission.comparison)).length;

    return {
      agreementRuns: agreements.length,
      averageAccuracy: roundTo(average(accuracies), 0),
      averageAgreement: roundTo(average(agreements), 0),
      averageCostUsd: roundTo(average(costs), 4),
      averageLatencyMs: roundTo(average(latencies), 0),
      baselineRuns: group.length - rerunRuns,
      costRuns: costs.length,
      key,
      latencyRuns: latencies.length,
      model: first.providerMeta.model,
      reasoningEffort: first.providerMeta.reasoningEffort ?? null,
      rerunRuns,
      reviewedRuns: accuracies.length,
      runs: group.length,
      totalCostUsd:
        costs.length > 0
          ? roundTo(costs.reduce((sum, value) => sum + value, 0), 4)
          : null,
    } satisfies ModelRunStats;
  });

  return stats.sort(
    (left, right) =>
      orderIndex(OPENAI_MODEL_IDS, left.model) - orderIndex(OPENAI_MODEL_IDS, right.model) ||
      left.model.localeCompare(right.model) ||
      orderIndex(OPENAI_REASONING_EFFORTS, left.reasoningEffort) -
        orderIndex(OPENAI_REASONING_EFFORTS, right.reasoningEffort),
  );
}
