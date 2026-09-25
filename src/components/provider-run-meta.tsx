import { cn } from "@/components/ui";
import {
  formatLatency,
  formatRunLabel,
  formatUsd,
} from "@/lib/ai/provider-meta";
import type { ProviderMeta } from "@/lib/package-categories";

export type ProviderRunMetaVariant = "inline" | "stacked";

export type ProviderRunMetaProps = {
  className?: string;
  providerMeta: Pick<
    ProviderMeta,
    "estimatedCostUsd" | "latencyMs" | "model" | "reasoningEffort"
  >;
  /** Hide the model label and show only latency and cost. */
  showModel?: boolean;
  variant?: ProviderRunMetaVariant;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "19.4 s · $0.220 est.", or null for legacy runs without run metadata. */
export function formatRunPerformance(
  providerMeta: Pick<ProviderMeta, "estimatedCostUsd" | "latencyMs">,
): string | null {
  const parts = [
    isFiniteNumber(providerMeta.latencyMs)
      ? formatLatency(providerMeta.latencyMs)
      : null,
    isFiniteNumber(providerMeta.estimatedCostUsd)
      ? `${formatUsd(providerMeta.estimatedCostUsd)} est.`
      : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Plain middot-separated run metadata: "Terra · High · 19.4 s · $0.220 est.".
 * `stacked` puts the performance on a second, muted line. Legacy runs that
 * only stored `model` render just the model name.
 */
export function ProviderRunMeta({
  className,
  providerMeta,
  showModel = true,
  variant = "inline",
}: ProviderRunMetaProps) {
  const runLabel = showModel ? formatRunLabel(providerMeta) : null;
  const performance = formatRunPerformance(providerMeta);

  if (variant === "stacked") {
    return (
      <span className={cn("flex min-w-0 flex-col", className)}>
        {runLabel ? <span className="truncate text-text">{runLabel}</span> : null}
        {performance ? (
          <span className="truncate text-caption text-text-muted tabular-nums">
            {performance}
          </span>
        ) : null}
      </span>
    );
  }

  const text = [runLabel, performance].filter(Boolean).join(" · ");

  return (
    <span className={cn("tabular-nums", className)}>{text || "—"}</span>
  );
}
