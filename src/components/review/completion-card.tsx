"use client";

import { useId } from "react";
import { ArrowRight, CircleCheck, X } from "lucide-react";

import { Button, Card, IconButton, LinkButton } from "@/components/ui";
import type { NextReviewTarget } from "@/lib/submissions/types";

export type CompletionCardProps = {
  /** "/submissions?{last query}" */
  allSubmissionsHref: string;
  /** "Next to review" target page. */
  hrefFor: (submissionId: string) => string;
  nextReview: NextReviewTarget | null;
  onDismiss: () => void;
  onRunAnotherModel: (() => void) | null;
  /** Why "Run another model" can't start, or null. */
  runAnotherDisabledReason: string | null;
  /** "84% accurate · 16 confirmed · 3 corrected" */
  summary: string;
  /** DOM id, so the workspace can scroll the card into view. */
  id: string;
  /** "NE555DR reviewed" */
  title: string;
};

/**
 * Shown after the save that completes the review (§4.3 item 2): what was
 * decided, then where to go next. The one primary action on the page at that
 * moment is "Next to review".
 */
export function CompletionCard({
  allSubmissionsHref,
  hrefFor,
  id,
  nextReview,
  onDismiss,
  onRunAnotherModel,
  runAnotherDisabledReason,
  summary,
  title,
}: CompletionCardProps) {
  const headingId = useId();

  return (
    <Card
      aria-labelledby={headingId}
      className="motion-safe:animate-float-in scroll-mt-[calc(var(--ui-header-height)+var(--ui-toolbar-height)+16px)]"
      id={id}
      padding="md"
      role="region"
      tabIndex={-1}
    >
      <div className="flex items-start gap-3">
        <CircleCheck aria-hidden="true" className="mt-px size-6 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title-3 break-words text-text" id={headingId}>
            {title}
          </h2>
          <p className="mt-0.5 text-callout text-text-muted tabular-nums">{summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {nextReview ? (
              <LinkButton href={hrefFor(nextReview.submissionId)} variant="primary">
                <span className="min-w-0 truncate">
                  Next to review: <span className="font-mono">{nextReview.partNumber}</span>
                </span>
                <ArrowRight aria-hidden="true" />
              </LinkButton>
            ) : null}
            {onRunAnotherModel ? (
              <Button
                aria-describedby={runAnotherDisabledReason ? `${headingId}-reason` : undefined}
                disabled={Boolean(runAnotherDisabledReason)}
                onClick={onRunAnotherModel}
                variant="secondary"
              >
                Run another model
              </Button>
            ) : null}
            <LinkButton href={allSubmissionsHref} variant="ghost">
              All submissions
            </LinkButton>
          </div>
          {onRunAnotherModel && runAnotherDisabledReason ? (
            <p className="mt-2 text-caption text-text-muted" id={`${headingId}-reason`}>
              {runAnotherDisabledReason}
            </p>
          ) : null}
        </div>
        <IconButton
          className="-mt-1 -mr-2"
          icon={<X />}
          label="Dismiss"
          onClick={onDismiss}
          size="sm"
          tooltip={false}
        />
      </div>
    </Card>
  );
}
