"use client";

import { Button, cn } from "@/components/ui";
import type { BulkConfirmPlan, ReviewRowRef } from "@/lib/submissions/review";

import { BulkConfirmButton } from "./review-section";

export type PinGroupHeaderProps = {
  className?: string;
  /** Id for the heading, so the group can be labelled by it. */
  headingId: string;
  /** Edit mode only: bulk plan over the group's VISIBLE rows (addendum M). */
  bulk?: { onConfirm: (refs: ReviewRowRef[]) => void; plan: BulkConfirmPlan } | null;
  /** The group's page, or null for "No evidence page". */
  page: number | null;
  /** Pending rows among all pins of the group. */
  pendingCount: number;
  /** All pins in the group (not only the visible ones). */
  pinCount: number;
  /** Omit when the PDF can't be shown. */
  onShowPage?: (page: number) => void;
};

/**
 * 32 px sticky header of a pin group (§4.3 item 8): "Page 13 · 40 pins ·
 * 12 pending", plus Show page and "Confirm N high-confidence". It sticks under
 * the review header and toolbar (--ui-header-height + --ui-toolbar-height).
 */
export function PinGroupHeader({
  bulk,
  className,
  headingId,
  onShowPage,
  page,
  pendingCount,
  pinCount,
}: PinGroupHeaderProps) {
  const title = page === null ? "No evidence page" : `Page ${page}`;

  return (
    <div
      className={cn(
        "sticky top-[calc(var(--ui-header-height)+var(--ui-toolbar-height))] z-[3] flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-border-subtle bg-surface-subtle px-4",
        className,
      )}
    >
      <h3 className="min-w-0 truncate text-callout text-text-muted tabular-nums" id={headingId}>
        <span className="font-medium text-text">{title}</span>
        {` · ${pinCount} ${pinCount === 1 ? "pin" : "pins"}`}
        {pendingCount > 0 ? ` · ${pendingCount} pending` : " · all decided"}
      </h3>
      <div className="flex shrink-0 items-center gap-2">
        {page !== null && onShowPage ? (
          <Button
            aria-label={`Show page ${page}`}
            onClick={() => onShowPage(page)}
            size="sm"
            variant="plain"
          >
            Show page
          </Button>
        ) : null}
        {bulk ? <BulkConfirmButton onConfirm={bulk.onConfirm} plan={bulk.plan} /> : null}
      </div>
    </div>
  );
}
