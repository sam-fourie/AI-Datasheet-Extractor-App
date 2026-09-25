import { getOpenAIModelDefinition } from "@/lib/ai/models";
import { formatReasoningEffortLabel } from "@/lib/ai/provider-meta";

/**
 * Display helpers shared by the Reports components. Pure and client-safe:
 * the numbers themselves come from `src/lib/submissions/reports.ts`.
 */

export const EMPTY_VALUE = "—";

export function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : EMPTY_VALUE;
}

/** Catalog label ("GPT-5.6 Terra"), or the raw id for unknown models. */
export function formatModelName(modelId: string) {
  return getOpenAIModelDefinition(modelId)?.label ?? modelId;
}

/** "High", or null when the run did not record an effort (legacy runs). */
export function formatEffortName(effort: string | null | undefined) {
  return typeof effort === "string" && effort.trim().length > 0
    ? formatReasoningEffortLabel(effort.trim())
    : null;
}

export function isDefaultCombination(
  entry: { model: string; reasoningEffort: string | null },
  defaults: { model: string; reasoningEffort: string | null } | null,
) {
  return (
    defaults !== null &&
    entry.model === defaults.model &&
    (entry.reasoningEffort ?? null) === (defaults.reasoningEffort ?? null)
  );
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/**
 * Round axis ticks from 0: a step of 1, 2, 2.5 or 5 × 10^n that covers
 * `max` in at most `count` intervals.
 */
export function niceTicks(max: number, count = 3): number[] {
  if (!Number.isFinite(max) || max <= 0) {
    return [0, 1];
  }

  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * magnitude)
      .find((candidate) => candidate * count >= max) ?? 10 * magnitude;
  const intervals = Math.max(1, Math.ceil(max / step - 1e-9));

  return Array.from({ length: intervals + 1 }, (_, index) =>
    Number((index * step).toPrecision(12)),
  );
}

/** Axis tick money: "$0", "$0.20", "$1.50", "$12". */
export function formatUsdTick(value: number) {
  if (value === 0) {
    return "$0";
  }

  return value >= 10 ? `$${Math.round(value)}` : `$${value.toFixed(2)}`;
}
