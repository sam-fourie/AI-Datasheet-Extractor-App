import { AppLink } from "@/components/app-link";
import type { DeleteSubmissionTarget } from "@/components/delete-submission-dialog";
import { RelativeTime } from "@/components/relative-time";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import { ScoreBadge } from "@/components/score-badge";
import { Badge, ProgressBar, Td, Tooltip, Tr } from "@/components/ui";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import type {
  DatasheetGroup,
  DatasheetListQuery,
  ReviewProgress,
} from "@/lib/submissions/types";

import {
  buildListHref,
  buildReviewHref,
  formatAgreementRange,
  isSearchingForPart,
  pluralize,
  runRowId,
} from "./datasheet-list-format";
import { RowActionsMenu } from "./row-actions-menu";
import { stretchedLinkClassName } from "./row-styles";
import { RunRows } from "./run-rows";
import { RunsDisclosureButton, RunsDisclosureGroup } from "./runs-disclosure";

function ReviewCell({
  progress,
  reviewedAt,
}: {
  progress: ReviewProgress;
  reviewedAt: string | null;
}) {
  if (progress.state === "reviewed") {
    return (
      <div className="flex flex-col gap-0.5">
        <ScoreBadge kind="accuracy" size="sm" value={progress.accuracy} />
        <span className="text-caption text-text-muted">
          Reviewed
          {reviewedAt ? (
            <>
              {" · "}
              <RelativeTime iso={reviewedAt} />
            </>
          ) : null}
        </span>
      </div>
    );
  }

  if (progress.state === "inProgress") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-callout font-medium text-accent-text">In review</span>
        <span className="flex items-center gap-2">
          <ProgressBar
            className="w-12! shrink-0"
            label="Review progress"
            segments={[
              { tone: "success", value: progress.confirmed },
              { tone: "danger", value: progress.corrected },
            ]}
            total={progress.total}
            valueText={`${progress.decided} of ${progress.total} decided`}
          />
          <span
            aria-hidden="true"
            className="text-caption whitespace-nowrap text-text-muted tabular-nums"
          >
            {progress.decided} / {progress.total}
          </span>
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-callout text-text-muted">
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-pending" />
      Not started
    </span>
  );
}

export type DatasheetRowGroupProps = {
  group: DatasheetGroup;
  query: DatasheetListQuery;
};

/**
 * One datasheet group: the baseline row (60 px, whole-row link on the part
 * number) and its re-runs as hidden child rows.
 */
export function DatasheetRowGroup({ group, query }: DatasheetRowGroupProps) {
  const { baseline, duplicateCount, isOrphanRun, runs } = group;
  const groupId = baseline.submissionId;
  const partNumber = baseline.partNumber;
  const runRowIds = runs.map((run) => runRowId(groupId, run.submissionId));
  const agreementRange = formatAgreementRange(group.scoredAgreementRange);
  const sourceTitle = baseline.source.originalUrl ?? baseline.source.fileName;
  const showDuplicate = duplicateCount > 0 && !isOrphanRun;
  const showAllLink = showDuplicate && !isSearchingForPart(query, partNumber);
  const deleteTarget: DeleteSubmissionTarget = isOrphanRun
    ? {
        baselineSubmissionId: null,
        kind: "rerun",
        model: baseline.providerMeta.model,
        submissionId: baseline.submissionId,
      }
    : {
        kind: "baseline",
        partNumber,
        runCount: runs.length,
        submissionId: baseline.submissionId,
      };

  return (
    <RunsDisclosureGroup groupId={groupId} runRowIds={runRowIds}>
      <Tr className="relative">
        <Td className="h-15! max-md:h-17! max-md:w-full max-md:max-w-0 max-md:py-3!">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <AppLink
                className={stretchedLinkClassName(
                  "min-w-0 truncate font-mono text-[13px] leading-[18px] font-medium text-text",
                )}
                data-row-link={baseline.submissionId}
                href={buildReviewHref(baseline.submissionId)}
              >
                {partNumber}
              </AppLink>
              {isOrphanRun ? (
                <Badge size="sm" tone="neutral">
                  Baseline deleted
                </Badge>
              ) : null}
              {showDuplicate ? (
                <Badge className="max-md:hidden" size="sm" tone="neutral">
                  Duplicate
                </Badge>
              ) : null}
              {showAllLink ? (
                <Tooltip
                  content={`${pluralize(duplicateCount, "other submission")} for this part number`}
                >
                  <AppLink
                    className="relative z-10 shrink-0 rounded-xs text-caption font-medium text-accent-text hover:underline max-md:hidden"
                    href={buildListHref({ q: partNumber })}
                  >
                    Show all
                  </AppLink>
                </Tooltip>
              ) : null}
              <ReviewStatusBadge
                className="ml-auto md:hidden"
                progress={baseline.reviewProgress}
                size="sm"
              />
            </div>
            <p
              className="mt-0.5 truncate text-caption text-text-muted max-md:hidden"
              title={sourceTitle}
            >
              {baseline.packageCategory} · {baseline.source.label}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-caption text-text-muted md:hidden">
              <span className="min-w-0 truncate">{baseline.packageCategory}</span>
              {runs.length > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <RunsDisclosureButton
                    className="shrink-0"
                    count={runs.length}
                    partNumber={partNumber}
                    variant="chip"
                  />
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <RelativeTime className="shrink-0" iso={group.lastActivityAt} />
            </div>
          </div>
        </Td>
        <Td className="hidden md:table-cell">
          <ReviewCell
            progress={baseline.reviewProgress}
            reviewedAt={baseline.reviewedAt}
          />
        </Td>
        <Td className="hidden md:table-cell">
          {runs.length > 0 ? (
            <div className="flex flex-col items-start gap-0.5">
              <RunsDisclosureButton count={runs.length} partNumber={partNumber} />
              {agreementRange ? (
                <span className="whitespace-nowrap text-caption text-text-muted tabular-nums">
                  {agreementRange}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-text-tertiary">
              <span aria-hidden="true">—</span>
              <span className="sr-only">No runs</span>
            </span>
          )}
        </Td>
        <Td className="hidden text-callout text-text xl:table-cell">
          <span className="block truncate">{formatRunLabel(baseline.providerMeta)}</span>
        </Td>
        <Td className="hidden text-callout text-text-muted md:table-cell">
          <RelativeTime iso={group.lastActivityAt} />
        </Td>
        <Td className="w-12 pl-0! text-right">
          <RowActionsMenu
            groupId={groupId}
            partNumber={partNumber}
            pdfHref={baseline.pdfHref}
            submissionId={baseline.submissionId}
            target={deleteTarget}
          />
        </Td>
      </Tr>
      {runs.length > 0 ? (
        <RunRows groupId={groupId} partNumber={partNumber} runs={runs} />
      ) : null}
    </RunsDisclosureGroup>
  );
}
