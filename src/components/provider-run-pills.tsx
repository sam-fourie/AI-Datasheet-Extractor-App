import { cn } from "@/components/ui/cn";
import { describeProviderRun } from "@/lib/ai/provider-meta";
import type { ProviderMeta } from "@/lib/package-categories";

const pillClassNames = {
  md: "rounded-pill border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-text-muted",
  sm: "rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted",
} as const;

type ProviderRunPillsProps = {
  providerMeta: ProviderMeta;
  size?: keyof typeof pillClassNames;
};

export function ProviderRunPills({
  providerMeta,
  size = "md",
}: ProviderRunPillsProps) {
  const run = describeProviderRun(providerMeta);
  const className = pillClassNames[size];

  return (
    <>
      <span
        className={cn(
          className,
          size === "sm" ? "uppercase tracking-[0.12em]" : undefined,
        )}
      >
        {run.modelLabel}
      </span>
      {run.tokens ? <span className={className}>{run.tokens}</span> : null}
      {run.performance ? (
        <span className={className}>{run.performance}</span>
      ) : null}
    </>
  );
}
