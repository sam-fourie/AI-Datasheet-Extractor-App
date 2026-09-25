import { AppLink } from "@/components/app-link";
import { RelativeTime } from "@/components/relative-time";
import { Card, cn, EmptyState } from "@/components/ui";
import type {
  AgreementMatrix as AgreementMatrixData,
  AgreementMatrixCell,
  AgreementMatrixColumn,
} from "@/lib/submissions/reports";
import { scoreTone, type ScoreTone } from "@/lib/submissions/score";

import { formatModelShortLabel } from "@/lib/ai/provider-meta";

import { EMPTY_VALUE, formatEffortName, pluralize } from "./report-format";
import { TooltipTarget } from "./tooltip-target";

const cellToneClassNames: Record<ScoreTone, string> = {
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-muted text-text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

const stickyColumnClassName =
  "sticky left-0 z-[1] shadow-[inset_-1px_0_0_var(--ui-border-subtle)]";

const cellBoxClassName =
  "flex h-9 w-18 items-center pointer-coarse:h-11 justify-center rounded-xs text-callout font-medium tabular-nums";

function CellTooltip({
  cell,
  column,
  partNumber,
}: {
  cell: AgreementMatrixCell;
  column: AgreementMatrixColumn;
  partNumber: string;
}) {
  const scored = cell.agreement !== null;

  return (
    <span className="flex flex-col gap-0.5 py-0.5">
      <span className="font-medium tabular-nums">
        {scored
          ? `${cell.agreement}% agreement${cell.scoredRuns > 1 ? ` (mean of ${cell.scoredRuns})` : ""}`
          : "Not scored"}
      </span>
      <span className="text-text-muted">
        {column.label} on <span className="font-mono">{partNumber}</span>
      </span>
      <span className="text-text-muted">
        {pluralize(cell.runCount, "run")}
        {cell.latestCreatedAt ? (
          <>
            {" · latest "}
            <RelativeTime iso={cell.latestCreatedAt} />
          </>
        ) : null}
      </span>
    </span>
  );
}

function MatrixCell({
  cell,
  column,
  partNumber,
}: {
  cell: AgreementMatrixCell;
  column: AgreementMatrixColumn;
  partNumber: string;
}) {
  if (cell.isBaseline && cell.runCount === 0) {
    return (
      <span className={cn(cellBoxClassName, "font-normal text-text-muted")}>Baseline</span>
    );
  }

  if (cell.runCount === 0 || cell.latestSubmissionId === null) {
    return (
      <span className={cn(cellBoxClassName, "font-normal text-text-tertiary")}>
        <span aria-hidden="true">{EMPTY_VALUE}</span>
        <span className="sr-only">No runs</span>
      </span>
    );
  }

  const scored = cell.agreement !== null;
  const tone = scored ? scoreTone(cell.agreement) : "neutral";

  return (
    <TooltipTarget
      aria-label={`${column.label}: ${scored ? `${cell.agreement}% agreement` : "not scored"}, ${pluralize(cell.runCount, "run")}. Open the latest run.`}
        className={cn(
          cellBoxClassName,
          cellToneClassNames[tone],
          "transition-[filter] duration-(--ui-duration-fast) hover:brightness-95",
          !scored && "text-caption font-normal",
        )}
      content={<CellTooltip cell={cell} column={column} partNumber={partNumber} />}
      describeChild={false}
      href={`/submissions/${cell.latestSubmissionId}`}
    >
      {scored ? `${cell.agreement}%` : "Unscored"}
    </TooltipTarget>
  );
}

export type AgreementMatrixProps = {
  defaults: { model: string; reasoningEffort: string | null } | null;
  /** A filter is active, so empty means "nothing matches" rather than "nothing yet". */
  filtered?: boolean;
  matrix: AgreementMatrixData;
};

/**
 * Reviewed baselines × model·effort (spec §6.2.4). Cells show the mean
 * scored agreement (addendum C) and link to the latest run of that
 * combination; the baseline's own combination reads "Baseline".
 */
export function AgreementMatrix({ defaults, filtered = false, matrix }: AgreementMatrixProps) {
  const hasScored = matrix.rows.some((row) =>
    row.cells.some((cell) => cell.agreement !== null),
  );

  if (matrix.rows.length === 0 || !hasScored) {
    return (
      <Card>
        <EmptyState
          className="py-8"
          description={
            filtered
              ? "Clear a filter to see results."
              : "Run another model on a reviewed datasheet to compare models."
          }
          title={filtered ? "No scored runs in this view" : "No scored runs yet"}
          titleAs="p"
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" padding="none">
      <div
        aria-label="Agreement by datasheet table"
        className="scroll-fade-x relative max-w-full overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-body">
          <caption className="sr-only">
            Agreement of each model and effort with the reviewed baseline, per datasheet
          </caption>
          <thead>
            <tr>
              <th
                className={cn(
                  stickyColumnClassName,
                  "h-12 border-b border-border bg-surface-subtle px-3 pl-4 text-caption font-medium whitespace-nowrap text-text-muted",
                )}
                scope="col"
              >
                Datasheet
              </th>
              {matrix.columns.map((column) => {
                const isDefault =
                  defaults !== null &&
                  column.model === defaults.model &&
                  column.reasoningEffort === defaults.reasoningEffort;
                const effort = formatEffortName(column.reasoningEffort);

                return (
                  <th
                    className="h-12 border-b border-border bg-surface-subtle px-1 text-center align-middle text-caption font-medium whitespace-nowrap text-text-muted last:pr-4"
                    key={column.key}
                    scope="col"
                  >
                    <span className="mx-auto flex w-18 flex-col items-center leading-4">
                      <span className={cn("inline-flex items-center gap-1", isDefault && "text-text")}>
                        {isDefault ? (
                          <span aria-hidden="true" className="size-1.5 rounded-pill bg-accent" />
                        ) : null}
                        {formatModelShortLabel(column.model)}
                      </span>
                      <span className="font-normal">{effort ?? "No effort"}</span>
                      {isDefault ? <span className="sr-only">(default)</span> : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr className="border-b border-border-subtle last:border-b-0" key={row.baselineSubmissionId}>
                <th
                  className={cn(stickyColumnClassName, "bg-surface px-3 py-2 pl-4 text-left font-normal")}
                  scope="row"
                >
                  <AppLink
                    className="block max-w-44 truncate rounded-xs font-mono text-callout text-text hover:underline sm:max-w-60"
                    href={`/submissions/${row.baselineSubmissionId}`}
                    title={row.partNumber}
                  >
                    {row.partNumber}
                  </AppLink>
                  <span className="block max-w-44 truncate text-caption text-text-muted sm:max-w-60">
                    {row.packageCategory}
                  </span>
                </th>
                {matrix.columns.map((column, index) => (
                  <td className="px-1 py-1.5 last:pr-4" key={column.key}>
                    <span className="flex justify-center">
                      <MatrixCell
                        cell={row.cells[index]}
                        column={column}
                        partNumber={row.partNumber}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border-subtle px-4 py-3 text-caption text-text-muted">
        Rows are reviewed datasheets with at least one re-run. Each cell is the mean agreement of
        that model and effort against the reviewed baseline and opens its latest run.
      </p>
    </Card>
  );
}
