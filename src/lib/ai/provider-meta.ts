import {
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

export function formatUsd(value: number) {
  const fractionDigits = value >= 1 ? 2 : value >= 0.01 ? 3 : 4;

  return `$${value.toFixed(fractionDigits)}`;
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
