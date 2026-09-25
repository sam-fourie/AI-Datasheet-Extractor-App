import { ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { formatRunPerformance } from "@/components/provider-run-meta";
import { RelativeTime } from "@/components/relative-time";
import { ScoreBadge } from "@/components/score-badge";
import { Td, Tr } from "@/components/ui";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import type { SubmissionListRun } from "@/lib/submissions/types";

import {
  buildReviewHref,
  describeUnscoredRun,
  runRowId,
} from "./datasheet-list-format";
import { stretchedLinkClassName } from "./row-styles";

function RunAgreement({ run }: { run: SubmissionListRun }) {
  const unscored = describeUnscoredRun(run);

  if (unscored) {
    return <span className="text-callout text-text-muted">{unscored}</span>;
  }

  return <ScoreBadge kind="agreement" size="sm" value={run.agreementPercentage} />;
}

export type RunRowsProps = {
  groupId: string;
  partNumber: string;
  runs: SubmissionListRun[];
};

/**
 * Child rows under a datasheet group, hidden until its runs disclosure is
 * expanded. Columns: model · effort | agreement | latency · cost | date | ›.
 */
export function RunRows({ groupId, partNumber, runs }: RunRowsProps) {
  return runs.map((run) => {
    const runLabel = formatRunLabel(run.providerMeta);
    const performance = formatRunPerformance(run.providerMeta);

    return (
      <Tr
        className="relative hidden bg-surface-subtle group-data-[expanded=true]/runs:table-row"
        id={runRowId(groupId, run.submissionId)}
        key={run.submissionId}
      >
        <Td className="py-2 pl-12! max-md:w-full max-md:max-w-0 max-md:pl-8!">
          <div className="flex min-w-0 items-center">
            <div className="min-w-0 flex-1">
              <AppLink
                className={stretchedLinkClassName(
                  "block truncate text-callout font-medium text-text",
                )}
                href={buildReviewHref(run.submissionId)}
              >
                {runLabel}
                <span className="sr-only"> run of {partNumber}</span>
              </AppLink>
              <div className="flex min-w-0 items-center gap-1.5 text-caption text-text-muted md:hidden">
                <span className="min-w-0 truncate">
                  <RunAgreement run={run} />
                </span>
                <span aria-hidden="true">·</span>
                <RelativeTime className="shrink-0" iso={run.createdAt} />
              </div>
            </div>
          </div>
        </Td>
        <Td className="hidden md:table-cell">
          <RunAgreement run={run} />
        </Td>
        <Td className="hidden text-callout text-text-muted tabular-nums md:table-cell">
          <span className="block truncate" title={performance ?? undefined}>
            {performance ?? "—"}
          </span>
        </Td>
        <Td className="hidden xl:table-cell" />
        <Td className="hidden text-callout text-text-muted md:table-cell">
          <RelativeTime iso={run.createdAt} />
        </Td>
        <Td className="text-right">
          <ChevronRight
            aria-hidden="true"
            className="ml-auto size-4 text-text-tertiary"
          />
        </Td>
      </Tr>
    );
  });
}
