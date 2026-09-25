import { cn, EmptyState } from "@/components/ui";
import type {
  AccuracyDistribution as AccuracyDistributionData,
  AccuracyDistributionBand,
  AccuracyDistributionItem,
} from "@/lib/submissions/reports";

import { ChartCard } from "./chart-card";
import { pluralize } from "./report-format";
import { TooltipTarget } from "./tooltip-target";

const segmentClassNames: Record<AccuracyDistributionBand["tone"], string> = {
  danger: "bg-danger",
  success: "bg-success",
  warning: "bg-warning",
};

const TOOLTIP_ITEM_LIMIT = 8;

function describeItem(item: AccuracyDistributionItem) {
  return item.isBaseline ? item.partNumber : `${item.partNumber} (${item.runLabel})`;
}

function BandTooltip({ band }: { band: AccuracyDistributionBand }) {
  if (band.items.length === 0) {
    return <span className="text-text-muted">No submissions in this band</span>;
  }

  const visible = band.items.slice(0, TOOLTIP_ITEM_LIMIT);
  const hidden = band.items.length - visible.length;

  return (
    <span className="flex flex-col gap-0.5 py-0.5">
      <span className="font-medium">
        {pluralize(band.count, "submission")} · {band.label}
      </span>
      {visible.map((item) => (
        <span className="flex justify-between gap-3" key={item.submissionId}>
          <span className="min-w-0 truncate font-mono">{describeItem(item)}</span>
          <span className="tabular-nums text-text-muted">{item.accuracy}%</span>
        </span>
      ))}
      {hidden > 0 ? <span className="text-text-muted">and {hidden} more</span> : null}
    </span>
  );
}

function share(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Reviewed submissions by accuracy band (spec §6.2.1): one stacked bar sized
 * by count, then a legend row per band whose tooltip lists the part numbers.
 */
export function AccuracyDistribution({
  distribution,
  filtered = false,
}: {
  distribution: AccuracyDistributionData;
  /** A filter is active, so empty means "nothing matches" rather than "nothing yet". */
  filtered?: boolean;
}) {
  const { bands, total } = distribution;
  const filledBands = bands.filter((band) => band.count > 0);
  const items = bands.flatMap((band) => band.items.map((item) => ({ band, item })));

  return (
    <ChartCard
      description={
        total > 0
          ? `${pluralize(total, "reviewed submission")} by accuracy`
          : "Reviewed submissions by accuracy"
      }
      table={
        total > 0
          ? {
              caption: "Accuracy of each reviewed submission",
              columns: [
                { label: "Part number" },
                { label: "Run" },
                { label: "Accuracy", numeric: true },
                { label: "Band" },
              ],
              rows: items.map(({ band, item }) => ({
                cells: [
                  <span className="font-mono text-callout" key="part">
                    {item.partNumber}
                  </span>,
                  item.isBaseline ? `${item.runLabel} (baseline)` : item.runLabel,
                  `${item.accuracy}%`,
                  band.label,
                ],
                key: item.submissionId,
              })),
            }
          : null
      }
      title="Accuracy distribution"
    >
      {total === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            className="py-8"
            description={
              filtered
                ? "Clear a filter to see results."
                : "Review a datasheet to see how accurate each run was."
            }
            title={filtered ? "No reviewed submissions in this view" : "No reviewed submissions yet"}
            titleAs="p"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div aria-hidden="true" className="flex h-3 w-full gap-0.5">
            {filledBands.map((band, index) => (
              <TooltipTarget
                className={cn(
                  "h-full min-w-1.5",
                  index === 0 && "rounded-l-pill",
                  index === filledBands.length - 1 && "rounded-r-pill",
                  segmentClassNames[band.tone],
                )}
                content={<BandTooltip band={band} />}
                key={band.tone}
                style={{ flexBasis: 0, flexGrow: band.count }}
              />
            ))}
          </div>
          <ul className="flex flex-col">
            {bands.map((band) => (
              <li className="border-b border-border-subtle last:border-b-0" key={band.tone}>
                <TooltipTarget
                  aria-label={`${band.label}: ${pluralize(band.count, "submission")}, ${share(band.count, total)}%`}
                  className="-mx-2 flex min-h-10 items-center gap-3 rounded-xs px-2 hover:bg-surface-hover pointer-coarse:min-h-11"
                  content={<BandTooltip band={band} />}
                  role="img"
                  side="bottom"
                  tabIndex={0}
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-2 shrink-0 rounded-pill", segmentClassNames[band.tone])}
                  />
                  <span className="min-w-0 flex-1 text-body text-text">{band.label}</span>
                  <span className="text-body font-medium text-text tabular-nums">
                    {band.count}
                  </span>
                  <span className="w-10 text-right text-callout text-text-muted tabular-nums">
                    {share(band.count, total)}%
                  </span>
                </TooltipTarget>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
