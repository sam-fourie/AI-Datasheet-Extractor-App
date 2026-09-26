"use client";

import type { ReactNode } from "react";

import { Button, Tooltip, cn } from "@/components/ui";
import type { BulkConfirmPlan, ReviewRowRef } from "@/lib/submissions/review";
import {
  describeFilteredOutSection,
  type FilteredSection,
  type ReviewFilter,
} from "@/lib/submissions/review-filters";

export type ReviewSectionProps = {
  /** Right-aligned header controls (bulk button, search). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Heading level; the review page's h1 is the part number, so sections are h2. */
  headingLevel?: 2 | 3;
  /** DOM id used by the toolbar section links and scroll-spy, e.g. "section-pins". */
  id: string;
  /** Muted text after the title, e.g. "8 of 10 decided". */
  meta?: ReactNode;
  title: ReactNode;
};

/**
 * A review section: title-3 heading, muted counts, right-side actions and the
 * section body. `scroll-margin-top` clears the sticky header and toolbar
 * (CSS vars --ui-header-height and --ui-toolbar-height).
 */
export function ReviewSection({
  actions,
  children,
  className,
  headingLevel = 2,
  id,
  meta,
  title,
}: ReviewSectionProps) {
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-[calc(var(--ui-header-height)+var(--ui-toolbar-height)+8px)]",
        className,
      )}
      id={id}
    >
      <div className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <Heading className="text-title-3 text-text" id={headingId}>
            {title}
          </Heading>
          {meta ? <p className="truncate text-callout text-text-muted tabular-nums">{meta}</p> : null}
        </div>
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export type BulkConfirmButtonProps = {
  className?: string;
  onConfirm: (refs: ReviewRowRef[]) => void;
  /** From planBulkConfirm over the VISIBLE rows of this scope. */
  plan: BulkConfirmPlan;
};

/**
 * Ghost "Confirm N high-confidence" (§5.5). Hidden when N is 0. The tooltip
 * "Skips M rows that need attention" is omitted when M is 0. Callers render
 * it only in edit mode (addendum M).
 */
export function BulkConfirmButton({ className, onConfirm, plan }: BulkConfirmButtonProps) {
  const count = plan.eligible.length;

  if (count === 0) {
    return null;
  }

  const skipped = plan.skippedForAttention;
  const button = (
    <Button
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onConfirm(plan.eligible);
      }}
      size="sm"
      variant="ghost"
    >
      Confirm {count} high-confidence
    </Button>
  );

  if (skipped === 0) {
    return button;
  }

  return (
    <Tooltip content={`Skips ${skipped} ${skipped === 1 ? "row that needs" : "rows that need"} attention`}>
      {button}
    </Tooltip>
  );
}

/** "8 of 10 decided". */
export function formatDecidedCount(counts: { pending: number; total: number }) {
  return `${counts.total - counts.pending} of ${counts.total} decided`;
}

/** Muted line shown when the filter or search hides every row of a section. */
export function FilteredOutNote({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 text-callout text-text-muted">{children}</p>;
}

/**
 * The note for a section the active filter empties: what the filter found,
 * plus "Show all" to go back to every row.
 */
export function FilteredOutSectionNote({
  filter = "all",
  onShowAll,
  section,
}: {
  filter?: ReviewFilter;
  onShowAll?: (section: FilteredSection) => void;
  section: FilteredSection;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-callout text-text-muted">
      <span>{describeFilteredOutSection(filter, section)}</span>
      {filter !== "all" && onShowAll ? (
        <Button onClick={() => onShowAll(section)} size="sm" variant="plain">
          Show all
        </Button>
      ) : null}
    </p>
  );
}
