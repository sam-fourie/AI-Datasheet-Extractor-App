import { ArrowRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { RelativeTime } from "@/components/relative-time";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import { Card, LinkButton } from "@/components/ui";
import type { DatasheetIndexEntry } from "@/lib/submissions/types";

export type RecentExtractionsProps = {
  entries: readonly DatasheetIndexEntry[];
};

/** The three newest baselines under the intake card, with a link to the archive. */
export function RecentExtractions({ entries }: RecentExtractionsProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="recent-extractions-title" className="space-y-2">
      <h2 className="px-1 text-callout font-medium text-text-muted" id="recent-extractions-title">
        Recent extractions
      </h2>
      <Card className="overflow-hidden" padding="none">
        <ul className="divide-y divide-border-subtle">
          {entries.slice(0, 3).map((entry) => (
            <li key={entry.submissionId}>
              <AppLink
                className="flex min-h-11 min-w-0 items-center gap-3 px-4 py-2.5 transition-colors duration-(--ui-duration-fast) ease-ui hover:bg-surface-hover focus-visible:-outline-offset-2"
                href={`/submissions/${entry.submissionId}`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] leading-[18px] text-text">
                  {entry.partNumber}
                </span>
                <ReviewStatusBadge progress={entry.reviewProgress} size="sm" />
                <RelativeTime
                  className="w-20 shrink-0 text-right text-caption text-text-muted tabular-nums max-[359px]:hidden"
                  iso={entry.createdAt}
                />
              </AppLink>
            </li>
          ))}
        </ul>
      </Card>
      <div className="px-1 pt-1">
        <LinkButton href="/submissions" size="sm" variant="plain">
          View all submissions
          <ArrowRight aria-hidden="true" />
        </LinkButton>
      </div>
    </section>
  );
}
