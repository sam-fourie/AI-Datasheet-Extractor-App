"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, Ellipsis, FileText, Info } from "lucide-react";

import {
  describeReviewStatus,
  ReviewStatusBadge,
  type ReviewStatusRerun,
} from "@/components/review-status-badge";
import {
  IconButton,
  LinkButton,
  Menu,
  Tooltip,
  cn,
  type BadgeTone,
  type MenuEntry,
} from "@/components/ui";
import type { ReviewProgress } from "@/lib/submissions/types";

import { DetailsPopover, type SubmissionDetailsProps } from "./details-popover";

export type ReviewHeaderProps = {
  /** The action cluster (md+): Edit review / Done / Discard + Save. */
  actions: ReactNode;
  /** "/submissions?{last list query}" */
  backHref: string;
  /** 768–1279 px on fine pointers: opens the datasheet sheet. */
  datasheetButton: { onClick: () => void } | null;
  details: SubmissionDetailsProps;
  isDirty: boolean;
  /** Overflow menu entries: desktop (md+) and mobile (adds Details, Runs, Discard). */
  menu: { desktop: MenuEntry[]; mobile: MenuEntry[] };
  /** "Small Outline Packages · ti.com · GPT-5.4 High · Mar 27" */
  meta: ReactNode;
  /** Plain-text meta for the button's title attribute. */
  metaTitle: string;
  /** Mobile "PDF" button: new tab at the active row's page, or null. */
  mobilePdfHref: string | null;
  partNumber: string;
  progress: ReviewProgress;
  rerun: ReviewStatusRerun | null;
  /** Run switcher trigger (md+). */
  runSwitcher: ReactNode;
  /** "Running Sol · 0:21" chip (md+), or null. */
  runningChip: ReactNode;
};

const dotToneClassNames: Record<BadgeTone, string> = {
  accent: "bg-accent",
  danger: "bg-danger",
  neutral: "bg-pending",
  success: "bg-success",
  warning: "bg-warning",
};

/**
 * The 56 px review header (§4.3; 52 px below 768): back, the part number as
 * the page's only h1, status, meta (Details popover), run switcher, running
 * chip, overflow menu and one action cluster. Sticky with the bar material.
 */
export function ReviewHeader({
  actions,
  backHref,
  datasheetButton,
  details,
  isDirty,
  menu,
  meta,
  metaTitle,
  mobilePdfHref,
  partNumber,
  progress,
  rerun,
  runSwitcher,
  runningChip,
}: ReviewHeaderProps) {
  const status = describeReviewStatus(progress, rerun);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-material backdrop-blur-[20px] backdrop-saturate-[1.8]">
      <div className="flex h-(--ui-header-height) items-center gap-2 px-2 sm:px-3 lg:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2">
          <Tooltip content="Back to submissions" describeChild={false}>
            <LinkButton
              aria-label="Back to submissions"
              href={backHref}
              iconOnly
              size="md"
              variant="ghost"
            >
              <ChevronLeft aria-hidden="true" />
            </LinkButton>
          </Tooltip>

          <h1
            className="min-w-[4.5rem] shrink truncate font-mono text-title-3 text-text"
            title={partNumber}
          >
            {partNumber}
          </h1>

          <ReviewStatusBadge className="max-md:hidden" progress={progress} rerun={rerun} />
          <span className="flex shrink-0 items-center md:hidden">
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-pill", dotToneClassNames[status.tone])}
            />
            <span className="sr-only">{status.text}</span>
          </span>

          {isDirty ? (
            <span className="flex shrink-0 items-center">
              <span aria-hidden="true" className="size-2 rounded-pill bg-accent" />
              <span className="sr-only">Unsaved changes</span>
            </span>
          ) : null}

          <div className="flex min-w-0 flex-1 max-xl:hidden">
            <DetailsPopover
              {...details}
              trigger={
                <button
                  aria-label={`Details: ${metaTitle}`}
                  className="group inline-flex min-w-0 items-center gap-1 rounded-xs px-1.5 py-1 text-left text-callout text-text-muted transition-colors duration-(--ui-duration-fast) ease-ui hover:bg-surface-hover hover:text-text"
                  title={metaTitle}
                  type="button"
                >
                  <span className="min-w-0 truncate">{meta}</span>
                  <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
                </button>
              }
            />
          </div>
          <div className="flex shrink-0 max-md:hidden xl:hidden">
            <DetailsPopover
              {...details}
              trigger={
                <IconButton icon={<Info />} label="Details" size="sm" tooltip={false} />
              }
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 max-md:hidden">
            {runSwitcher}
            {runningChip}
            {datasheetButton ? (
              <IconButton
                icon={<FileText />}
                label="Show datasheet"
                onClick={datasheetButton.onClick}
                shortcut="P"
                size="sm"
                variant="secondary"
              />
            ) : null}
          </div>

          {mobilePdfHref ? (
            <a
              className="inline-flex h-8 items-center justify-center rounded-sm px-2 text-callout font-medium text-accent-text pointer-coarse:min-h-11 pointer-coarse:min-w-11 md:hidden"
              href={mobilePdfHref}
              rel="noopener"
              target="_blank"
            >
              PDF<span className="sr-only"> (opens in new tab)</span>
            </a>
          ) : null}

          <div className="max-md:hidden">
            <Menu
              align="end"
              items={menu.desktop}
              label={`Actions for ${partNumber}`}
              trigger={
                <IconButton icon={<Ellipsis />} label="More actions" size="sm" tooltip={false} />
              }
            />
          </div>
          <div className="md:hidden">
            <Menu
              align="end"
              items={menu.mobile}
              label={`Actions for ${partNumber}`}
              trigger={<IconButton icon={<Ellipsis />} label="More actions" tooltip={false} />}
            />
          </div>

          <div className="flex items-center gap-2 max-md:hidden" data-review-actions="">
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}
