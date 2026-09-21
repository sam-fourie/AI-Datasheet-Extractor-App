import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import {
  formatLatency,
  formatReasoningEffort,
  formatUsd,
} from "@/lib/ai/provider-meta";
import type { ModelRunStats } from "@/lib/submissions/model-stats";

const gridClassName =
  "lg:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]";

type StatCellProps = {
  detail: string;
  label: string;
  value: string;
};

function StatCell({ detail, label, value }: StatCellProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 lg:block">
      <span className="text-xs uppercase tracking-[0.12em] text-text-muted lg:hidden">
        {label}
      </span>
      <span className="text-right lg:text-left">
        <span className="block text-sm font-medium text-text">{value}</span>
        <span className="block text-xs leading-5 text-text-muted">{detail}</span>
      </span>
    </div>
  );
}

function formatPercentage(value: number | null) {
  return value === null ? "n/a" : `${value}%`;
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

type ModelPerformanceTableProps = {
  stats: ModelRunStats[];
};

export function ModelPerformanceTable({ stats }: ModelPerformanceTableProps) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
          Model Comparison
        </p>
        <h3 className="text-2xl">Model performance</h3>
        <p className="max-w-3xl text-sm leading-6 text-text-muted">
          Accuracy comes from reviewed submissions. Agreement covers re-runs
          scored against a fully reviewed baseline. Cost is estimated at list
          prices from the recorded token usage.
        </p>
      </div>

      <div className="overflow-hidden rounded-control border border-border">
        <div
          className={cn(
            "hidden bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted lg:grid lg:gap-4",
            gridClassName,
          )}
        >
          <span>Model</span>
          <span>Runs</span>
          <span>Reviewed accuracy</span>
          <span>Agreement</span>
          <span>Avg latency</span>
          <span>Cost</span>
        </div>
        {stats.map((row) => (
          <div
            key={row.key}
            className={cn(
              "grid gap-3 border-t border-border px-4 py-3 lg:items-center lg:gap-4",
              gridClassName,
            )}
          >
            <div>
              <p className="text-sm font-medium text-text">{row.model}</p>
              <p className="text-xs leading-5 text-text-muted">
                {row.reasoningEffort
                  ? `${formatReasoningEffort(row.reasoningEffort)} effort`
                  : "effort not recorded"}
              </p>
            </div>
            <StatCell
              detail={`${row.baselineRuns} baseline · ${row.rerunRuns} re-run`}
              label="Runs"
              value={String(row.runs)}
            />
            <StatCell
              detail={pluralize(row.reviewedRuns, "reviewed run")}
              label="Reviewed accuracy"
              value={formatPercentage(row.averageAccuracy)}
            />
            <StatCell
              detail={pluralize(row.agreementRuns, "scored re-run")}
              label="Agreement"
              value={formatPercentage(row.averageAgreement)}
            />
            <StatCell
              detail={pluralize(row.latencyRuns, "timed run")}
              label="Avg latency"
              value={
                row.averageLatencyMs === null
                  ? "n/a"
                  : formatLatency(row.averageLatencyMs)
              }
            />
            <StatCell
              detail={
                row.totalCostUsd === null
                  ? "no usage recorded"
                  : `${formatUsd(row.totalCostUsd)} total`
              }
              label="Cost"
              value={
                row.averageCostUsd === null
                  ? "n/a"
                  : `${formatUsd(row.averageCostUsd)} avg`
              }
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
