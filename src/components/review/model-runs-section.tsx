"use client";

import { AppLink } from "@/components/app-link";
import { RelativeTime } from "@/components/relative-time";
import { describeReviewStatus } from "@/components/review-status-badge";
import { ScoreBadge } from "@/components/score-badge";
import {
  Badge,
  Button,
  Card,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
} from "@/components/ui";
import { formatLatency, formatRunLabel, formatUsd } from "@/lib/ai/provider-meta";
import { describeAgreementBasis } from "@/lib/submissions/agreement";
import type { SubmissionModelRun } from "@/lib/submissions/types";

import { ReviewSection } from "./review-section";
import { REVIEW_SECTION_IDS } from "./types";

export type RunningModelRun = {
  id: string;
  /** e.g. "Sol · High" */
  label: string;
};

export type ModelRunsSectionProps = {
  className?: string;
  /** The page's submission id; its row is highlighted with aria-current="page". */
  currentSubmissionId: string;
  /** Review page href for a run. Default `/submissions/{id}`. */
  hrefFor?: (submissionId: string) => string;
  /** "Run another model…". Omit to hide the button. */
  onRunAnotherModel?: () => void;
  /** e.g. `/reports?datasheet={rootId}#matrix` */
  reportsHref: string;
  /**
   * Why "Run another model…" is disabled ("Save or discard your review
   * changes first", PDF not kept, 3 runs in progress), or null when enabled.
   */
  runAnotherDisabledReason?: string | null;
  /** Background re-runs in flight for this group (placeholder rows). */
  runningRuns?: readonly RunningModelRun[];
  /** listSubmissionModelRuns(rootId): the baseline first, then re-runs oldest first. */
  runs: readonly SubmissionModelRun[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function progressText(run: SubmissionModelRun) {
  const { decided, state, total } = run.reviewProgress;

  if (state === "notStarted") {
    return run.isBaseline ? "Not started" : "Not reviewed";
  }

  if (state === "inProgress") {
    return `In review · ${decided} of ${total}`;
  }

  return describeReviewStatus(run.reviewProgress).text;
}

// Module-level so the React Compiler can compile the component (it cannot
// reorder an inline arrow used as a default parameter).
function defaultHrefFor(submissionId: string) {
  return `/submissions/${submissionId}`;
}

/**
 * "Model runs" section (addendum J): the baseline plus every re-run with
 * model · effort, agreement (a coloured score only when scored, else neutral
 * text per addendum C), latency, cost, date and an Open link. The footer
 * holds "Run another model…" and "Compare in Reports →". On a re-run page the
 * current run is highlighted.
 */
export function ModelRunsSection({
  className,
  currentSubmissionId,
  hrefFor = defaultHrefFor,
  onRunAnotherModel,
  reportsHref,
  runAnotherDisabledReason = null,
  runningRuns = [],
  runs,
}: ModelRunsSectionProps) {
  const rerunCount = runs.filter((run) => !run.isBaseline).length;
  const onlyBaseline = rerunCount === 0 && runningRuns.length === 0;

  return (
    <ReviewSection
      className={className}
      id={REVIEW_SECTION_IDS.runs}
      meta={
        rerunCount > 0
          ? `Baseline and ${rerunCount} ${rerunCount === 1 ? "run" : "runs"}`
          : null
      }
      title="Model runs"
    >
      <Card className="overflow-hidden" padding="none">
        {runs.length > 0 ? (
          <Table caption="Runs on this datasheet" density="compact">
            <THead>
              <tr>
                <Th>Run</Th>
                <Th>Agreement</Th>
                <Th className="hidden sm:table-cell" numeric>
                  Latency
                </Th>
                <Th className="hidden sm:table-cell" numeric>
                  Est. cost
                </Th>
                <Th className="hidden md:table-cell">Date</Th>
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {runs.map((run) => {
                const current = run.submissionId === currentSubmissionId;
                const label = formatRunLabel(run.providerMeta);
                const agreement = run.isBaseline ? null : describeAgreementBasis(run.agreement);

                return (
                  <Tr aria-current={current ? "page" : undefined} key={run.submissionId} selected={current}>
                    <Td className="min-w-0 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-text">{label}</span>
                        {run.isBaseline ? (
                          <Badge size="sm" tone="neutral">
                            Baseline
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-caption text-text-muted">{progressText(run)}</p>
                    </Td>
                    <Td>
                      {run.isBaseline ? (
                        <span className="text-callout text-text-muted">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Not applicable</span>
                        </span>
                      ) : agreement?.scored ? (
                        <ScoreBadge kind="agreement" size="sm" value={agreement.value} />
                      ) : (
                        <span className="text-callout text-text-muted">{agreement?.text}</span>
                      )}
                    </Td>
                    <Td className="hidden text-callout text-text-muted sm:table-cell" numeric>
                      {isFiniteNumber(run.providerMeta.latencyMs) ? formatLatency(run.providerMeta.latencyMs) : "—"}
                    </Td>
                    <Td className="hidden text-callout text-text-muted sm:table-cell" numeric>
                      {isFiniteNumber(run.providerMeta.estimatedCostUsd)
                        ? formatUsd(run.providerMeta.estimatedCostUsd)
                        : "—"}
                    </Td>
                    <Td className="hidden text-callout whitespace-nowrap text-text-muted md:table-cell">
                      <RelativeTime iso={run.createdAt} />
                    </Td>
                    <Td className="text-right">
                      {current ? (
                        <span className="text-callout text-text-muted">Viewing</span>
                      ) : (
                        <AppLink
                          className="inline-flex items-center text-callout font-medium text-accent-text hover:underline pointer-coarse:min-h-11"
                          href={hrefFor(run.submissionId)}
                        >
                          Open<span className="sr-only">{` ${run.isBaseline ? "baseline" : "run"} ${label}`}</span>
                        </AppLink>
                      )}
                    </Td>
                  </Tr>
                );
              })}
              {runningRuns.map((run) => (
                <Tr key={run.id}>
                  <Td className="py-2">
                    <span className="font-medium text-text">{run.label}</span>
                    <p className="text-caption text-text-muted">Running…</p>
                  </Td>
                  <Td colSpan={5}>
                    <Spinner label={`${run.label} is running`} size={14} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : null}
        {onlyBaseline ? (
          <p className="border-t border-border-subtle px-4 py-3 text-callout text-text-muted">
            No other runs yet. Run another model to measure agreement.
          </p>
        ) : null}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-subtle px-4 py-3",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {onRunAnotherModel ? (
              <Button
                disabled={Boolean(runAnotherDisabledReason)}
                onClick={onRunAnotherModel}
                size="sm"
                variant="secondary"
              >
                Run another model…
              </Button>
            ) : null}
            {onRunAnotherModel && runAnotherDisabledReason ? (
              <span className="text-caption text-text-muted">{runAnotherDisabledReason}</span>
            ) : null}
          </div>
          <AppLink className="text-callout font-medium text-accent-text hover:underline" href={reportsHref}>
            Compare in Reports →
          </AppLink>
        </div>
      </Card>
    </ReviewSection>
  );
}
