import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Badge, Card, cn, EmptyState, Table, TBody, Td, Th, THead, Tr } from "@/components/ui";
import { getOpenAIModelDefinition, type OpenAIModelRole } from "@/lib/ai/models";
import { formatLatency, formatUsd } from "@/lib/ai/provider-meta";
import type { ModelRunStats } from "@/lib/submissions/model-stats";
import {
  defaultSortDirection,
  serializeReportsQuery,
  type LeaderboardSortKey,
  type ReportsQuery,
} from "@/lib/submissions/reports";
import { scoreTone, type ScoreTone } from "@/lib/submissions/score";

import {
  EMPTY_VALUE,
  formatEffortName,
  formatModelName,
  isDefaultCombination,
} from "./report-format";

const ROLE_LABELS: Partial<Record<OpenAIModelRole, string>> = {
  budget: "Budget",
  candidate: "Candidate",
  control: "Control",
  premium: "Premium",
};

const meterClassNames: Record<ScoreTone, string> = {
  danger: "bg-danger",
  neutral: "bg-chart-neutral",
  success: "bg-success",
  warning: "bg-warning",
};

/** First column stays put while the table scrolls sideways (narrow screens). */
const stickyColumnClassName =
  "sticky left-0 z-[1] shadow-[inset_-1px_0_0_var(--ui-border-subtle)] xl:shadow-none";
const stickyBodyCellClassName = cn(
  stickyColumnClassName,
  "bg-surface group-hover/row:bg-[image:linear-gradient(var(--ui-surface-hover),var(--ui-surface-hover))]",
);

function ScoreMeter({ runs, value }: { runs: number; value: number | null }) {
  if (value === null) {
    // The dash sits where the percentage would, so columns stay aligned.
    return (
      <span className="inline-flex items-center justify-end gap-2">
        <span className="w-10 text-right text-text-muted">
          <span aria-hidden="true">{EMPTY_VALUE}</span>
          <span className="sr-only">No score</span>
        </span>
        <span aria-hidden="true" className="w-9" />
      </span>
    );
  }

  const tone = scoreTone(value);

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span
        aria-hidden="true"
        className="relative hidden h-1 w-12 shrink-0 overflow-hidden rounded-pill bg-surface-muted xl:block"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-pill", meterClassNames[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className="w-10 text-right font-medium text-text">{value}%</span>
      <span className="w-9 text-left text-caption text-text-muted">n={runs}</span>
    </span>
  );
}

function ValueWithCount({
  count,
  runs,
  value,
}: {
  count: number;
  runs: number;
  value: string | null;
}) {
  if (value === null) {
    return (
      <span className="text-text-muted">
        {EMPTY_VALUE}
        <span className="sr-only">No data</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline justify-end gap-1.5">
      <span>{value}</span>
      {count < runs ? (
        <span className="text-caption text-text-muted">n={count}</span>
      ) : null}
    </span>
  );
}

type SortableColumn = {
  key: LeaderboardSortKey;
  label: string;
};

function SortHeader({
  column,
  query,
}: {
  column: SortableColumn;
  query: ReportsQuery;
}) {
  const active = query.sort === column.key;
  const nextDir = active
    ? query.dir === "asc"
      ? "desc"
      : "asc"
    : defaultSortDirection(column.key);
  const search = serializeReportsQuery({ ...query, dir: nextDir, sort: column.key });
  const Icon = active ? (query.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <Th
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}
      numeric
    >
      <AppLink
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-xs px-1 py-1 hover:text-text pointer-coarse:min-h-11",
          active && "text-text",
        )}
        href={`/reports${search ? `?${search}` : ""}`}
        replace
        scroll={false}
      >
        {column.label}
        <Icon
          aria-hidden="true"
          className={cn("size-3 shrink-0", active ? "text-text" : "text-text-tertiary")}
        />
      </AppLink>
    </Th>
  );
}

export type ModelLeaderboardProps = {
  defaults: { model: string; reasoningEffort: string | null } | null;
  /** A filter is active, so empty means "nothing matches" rather than "nothing yet". */
  filtered?: boolean;
  query: ReportsQuery;
  stats: ModelRunStats[];
};

/**
 * One row per model·effort from summarizeModelRuns over the filtered scope,
 * sorted server-side from the URL (`sort`, `dir`).
 */
export function ModelLeaderboard({
  defaults,
  filtered = false,
  query,
  stats,
}: ModelLeaderboardProps) {
  if (stats.length === 0) {
    return (
      <Card>
        <EmptyState
          className="py-8"
          description={
            filtered
              ? "Clear a filter to see results."
              : "Extract a datasheet to see how each model performs."
          }
          title={filtered ? "No model runs in this view" : "No model runs yet"}
          titleAs="p"
        />
      </Card>
    );
  }

  const sortLabel = {
    accuracy: "accuracy",
    agreement: "agreement",
    cost: "average cost",
    latency: "median latency",
    runs: "runs",
  }[query.sort];

  return (
    <Card className="overflow-hidden" padding="none">
      <div
        aria-label="Model leaderboard table"
        className="scroll-fade-x relative max-w-full overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <Table
          caption={`Model leaderboard, sorted by ${sortLabel} ${query.dir === "asc" ? "ascending" : "descending"}`}
          scrollX={false}
        >
          <THead>
            <tr>
              <Th className={stickyColumnClassName}>Model</Th>
              <Th>Effort</Th>
              <SortHeader column={{ key: "runs", label: "Runs" }} query={query} />
              <SortHeader column={{ key: "accuracy", label: "Accuracy" }} query={query} />
              <SortHeader column={{ key: "agreement", label: "Agreement" }} query={query} />
              <SortHeader column={{ key: "latency", label: "Median latency" }} query={query} />
              <SortHeader column={{ key: "cost", label: "Avg cost" }} query={query} />
              <Th numeric>Total cost</Th>
            </tr>
          </THead>
          <TBody>
            {stats.map((stat) => {
              const isDefault = isDefaultCombination(stat, defaults);
              const role = getOpenAIModelDefinition(stat.model)?.role;
              const roleLabel = role ? ROLE_LABELS[role] : undefined;
              const effort = formatEffortName(stat.reasoningEffort);

              return (
                <Tr className="group/row" key={stat.key}>
                  <th
                    className={cn(stickyBodyCellClassName, "px-3 py-2 pl-4 text-left font-normal")}
                    scope="row"
                  >
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="font-medium text-text">
                        {formatModelName(stat.model)}
                      </span>
                      {isDefault ? (
                        <Badge size="sm" tone="accent">
                          Default
                        </Badge>
                      ) : roleLabel ? (
                        <Badge size="sm" tone="neutral">
                          {roleLabel}
                        </Badge>
                      ) : null}
                    </span>
                  </th>
                  <Td className="whitespace-nowrap">
                    {effort ?? (
                      <span className="text-text-muted">
                        {EMPTY_VALUE}
                        <span className="sr-only">Not recorded</span>
                      </span>
                    )}
                  </Td>
                  <Td numeric>{stat.runs}</Td>
                  <Td numeric>
                    <ScoreMeter runs={stat.reviewedRuns} value={stat.averageAccuracy} />
                  </Td>
                  <Td numeric>
                    <ScoreMeter runs={stat.agreementRuns} value={stat.averageAgreement} />
                  </Td>
                  <Td numeric>
                    <ValueWithCount
                      count={stat.latencyRuns}
                      runs={stat.runs}
                      value={stat.medianLatencyMs === null ? null : formatLatency(stat.medianLatencyMs)}
                    />
                  </Td>
                  <Td numeric>
                    <ValueWithCount
                      count={stat.costRuns}
                      runs={stat.runs}
                      value={stat.averageCostUsd === null ? null : formatUsd(stat.averageCostUsd)}
                    />
                  </Td>
                  <Td numeric>
                    <ValueWithCount
                      count={stat.costRuns}
                      runs={stat.runs}
                      value={stat.totalCostUsd === null ? null : formatUsd(stat.totalCostUsd)}
                    />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
      <p className="border-t border-border-subtle px-4 py-3 text-caption text-text-muted">
        Accuracy averages reviewed runs and agreement averages runs scored against fully reviewed
        baselines; n is the number of runs behind each. Latency and cost show n when some runs have
        no usage data.
      </p>
    </Card>
  );
}
