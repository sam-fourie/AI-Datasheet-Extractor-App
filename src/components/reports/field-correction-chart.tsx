import { Card, EmptyState } from "@/components/ui";
import {
  FIELD_CORRECTION_MIN_DECISIONS,
  type FieldCorrectionReport,
  type FieldCorrectionStat,
} from "@/lib/submissions/reports";

import { pluralize } from "./report-format";
import { TooltipTarget } from "./tooltip-target";

function CorrectionRow({ stat }: { stat: FieldCorrectionStat }) {
  const summary = `${stat.corrected} of ${stat.decided} corrected (${stat.correctionRate}%)`;

  return (
    <li>
      <TooltipTarget
        aria-label={`${stat.label}: ${summary}`}
        className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-xs px-2 py-2 hover:bg-surface-hover sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_11rem]"
        content={
          <span className="flex flex-col gap-0.5 py-0.5">
            <span className="font-medium tabular-nums">{stat.correctionRate}% corrected</span>
            <span className="text-text-muted">
              {stat.label} · {stat.corrected} of {stat.decided} decisions
            </span>
          </span>
        }
        describeChild={false}
        role="img"
        tabIndex={0}
      >
        <span className="min-w-0 truncate text-body text-text">{stat.label}</span>
        <span className="col-span-2 row-start-2 flex h-2 min-w-0 items-center overflow-visible rounded-r-pill bg-surface-muted sm:col-span-1 sm:row-start-auto">
          {stat.corrected > 0 ? (
            <span
              className="h-full rounded-r-pill bg-chart-neutral-strong"
              style={{ width: `${Math.max(1, Math.min(100, (stat.corrected / stat.decided) * 100))}%` }}
            />
          ) : null}
        </span>
        <span className="text-right text-callout text-text-muted tabular-nums sm:col-start-3 sm:row-start-1">
          <span className="text-text">{stat.corrected}</span> of {stat.decided} corrected (
          {stat.correctionRate}%)
        </span>
      </TooltipTarget>
    </li>
  );
}

/**
 * Measurement fields with the highest correction rate (corrected ÷ decided)
 * across fully reviewed submissions, then Pins and Package (spec §6.2.5).
 */
export function FieldCorrectionChart({
  filtered = false,
  report,
}: {
  /** A filter is active, so empty means "nothing matches" rather than "nothing yet". */
  filtered?: boolean;
  report: FieldCorrectionReport;
}) {
  const extras = [report.pins, report.package].filter(
    (stat): stat is FieldCorrectionStat => stat !== null,
  );

  if (report.reviewedSubmissions === 0 || (report.fields.length === 0 && extras.length === 0)) {
    return (
      <Card>
        <EmptyState
          className="py-8"
          description={
            filtered
              ? "Clear a filter to see results."
              : "Correction rates appear once a datasheet is reviewed."
          }
          title={
            filtered ? "No fully reviewed submissions in this view" : "No fully reviewed submissions yet"
          }
          titleAs="p"
        />
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-callout text-text-muted">
        Share of decisions a reviewer corrected, across{" "}
        {pluralize(report.reviewedSubmissions, "fully reviewed submission")}.
      </p>
      {report.fields.length > 0 ? (
        <ol aria-label="Measurement fields by correction rate" className="mt-4 flex flex-col">
          {report.fields.map((stat) => (
            <CorrectionRow key={stat.key} stat={stat} />
          ))}
        </ol>
      ) : null}
      {extras.length > 0 ? (
        <ul
          aria-label="Pins and package"
          className="mt-2 flex flex-col border-t border-border-subtle pt-2"
        >
          {extras.map((stat) => (
            <CorrectionRow key={stat.key} stat={stat} />
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-caption text-text-muted">
        Fields with fewer than {FIELD_CORRECTION_MIN_DECISIONS} decisions are left out
        {report.excludedFieldCount > 0
          ? ` (${pluralize(report.excludedFieldCount, "field")} this time)`
          : ""}
        . Pins count every pin decision.
      </p>
    </Card>
  );
}
