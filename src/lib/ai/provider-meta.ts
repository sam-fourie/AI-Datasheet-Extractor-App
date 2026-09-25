import {
  getOpenAIModelDefinition,
  isOpenAIReasoningEffort,
  REASONING_EFFORT_LABELS,
} from "@/lib/ai/models";
import type { ProviderMeta } from "@/lib/package-categories";

/**
 * Display helpers for the provider metadata stored with every extraction.
 * Older submissions only carry `model` and `provider`, so every extra field
 * is treated as optional here.
 */

export type ProviderRunDescription = {
  modelLabel: string;
  performance: string | null;
  tokens: string | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatTokenCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return new Intl.NumberFormat("en").format(Math.round(value));
}

/**
 * Run cost: two decimals at or above $0.10 ("$0.22", "$6.98"), three from
 * $0.01 ("$0.033"), four below ("$0.0042"). Thresholds are checked after
 * rounding, so $0.0996 reads "$0.10" rather than "$0.100". Zero is "$0.00".
 */
export function formatUsd(value: number) {
  if (value === 0) {
    return "$0.00";
  }

  const magnitude = Math.abs(value);
  const fractionDigits =
    Number(magnitude.toFixed(3)) >= 0.1 ? 2 : Number(magnitude.toFixed(4)) >= 0.01 ? 3 : 4;

  return `${value < 0 ? "-" : ""}$${magnitude.toFixed(fractionDigits)}`;
}

export function formatLatency(milliseconds: number) {
  if (milliseconds >= 1_000) {
    return `${(milliseconds / 1_000).toFixed(1)} s`;
  }

  return `${Math.round(milliseconds)} ms`;
}

export function formatReasoningEffort(effort: string) {
  return isOpenAIReasoningEffort(effort)
    ? REASONING_EFFORT_LABELS[effort].toLowerCase()
    : effort;
}

export function describeProviderRun(
  providerMeta: ProviderMeta,
): ProviderRunDescription {
  const effort =
    typeof providerMeta.reasoningEffort === "string" &&
    providerMeta.reasoningEffort.length > 0
      ? providerMeta.reasoningEffort
      : null;
  const modelLabel = effort
    ? `${providerMeta.model} · ${formatReasoningEffort(effort)} effort`
    : providerMeta.model;
  const usage = providerMeta.usage;
  let tokens: string | null = null;

  if (
    usage &&
    isFiniteNumber(usage.inputTokens) &&
    isFiniteNumber(usage.outputTokens)
  ) {
    const reasoningSuffix =
      isFiniteNumber(usage.reasoningTokens) && usage.reasoningTokens > 0
        ? ` (${formatTokenCount(usage.reasoningTokens)} reasoning)`
        : "";

    tokens = `${formatTokenCount(usage.inputTokens)} in · ${formatTokenCount(usage.outputTokens)} out${reasoningSuffix}`;
  }

  const performanceParts = [
    isFiniteNumber(providerMeta.latencyMs)
      ? formatLatency(providerMeta.latencyMs)
      : null,
    isFiniteNumber(providerMeta.estimatedCostUsd)
      ? `${formatUsd(providerMeta.estimatedCostUsd)} est.`
      : null,
  ].filter((part): part is string => part !== null);

  return {
    modelLabel,
    performance: performanceParts.length > 0 ? performanceParts.join(" · ") : null,
    tokens,
  };
}

const CODE_NAMED_LABEL_PATTERN = /^GPT-\d+(?:\.\d+)*\s+(\S.*)$/i;

/**
 * Short model name for dense UI: the code name when there is one
 * ("gpt-5.6-terra" or "GPT-5.6 Terra" -> "Terra", "gpt-6-astra" -> "Astra"),
 * otherwise the catalog label ("gpt-5.4" -> "GPT-5.4"). Unknown ids are
 * returned as-is.
 */
export function formatModelShortLabel(modelId: string): string {
  const definition = getOpenAIModelDefinition(modelId);
  const label = definition?.label ?? modelId;
  const codeName = label.match(CODE_NAMED_LABEL_PATTERN)?.[1];

  return codeName ?? label;
}

/** Title-case effort label: "High", "Extra high"; unknown values as-is. */
export function formatReasoningEffortLabel(effort: string) {
  return isOpenAIReasoningEffort(effort) ? REASONING_EFFORT_LABELS[effort] : effort;
}

/** "Terra · High", or just "Terra" when the run has no stored effort. */
export function formatRunLabel(
  providerMeta: Pick<ProviderMeta, "model" | "reasoningEffort">,
): string {
  const model = formatModelShortLabel(providerMeta.model);
  const effort =
    typeof providerMeta.reasoningEffort === "string" &&
    providerMeta.reasoningEffort.trim().length > 0
      ? formatReasoningEffortLabel(providerMeta.reasoningEffort.trim())
      : null;

  return effort ? `${model} · ${effort}` : model;
}
