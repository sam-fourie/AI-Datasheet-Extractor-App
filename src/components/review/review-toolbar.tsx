"use client";

import type { MouseEvent, ReactNode } from "react";
import { ArrowDownToLine, Check, ChevronDown, ListFilter, PanelRightOpen } from "lucide-react";

import {
  Button,
  IconButton,
  Menu,
  ProgressBar,
  Tooltip,
  cn,
  type MenuEntry,
} from "@/components/ui";

import type { ReviewFilter } from "@/lib/submissions/review-filters";
import { DATASHEET_OPEN_BUTTON_ID, REVIEW_FILTER_LABELS } from "./types";

/** Compact trigger text. The menu and the accessible name use the full labels. */
const SHORT_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "All",
  attention: "Attention",
  differs: "Differs",
  incorrect: "Incorrect",
  pending: "Pending",
  runsDisagree: "Runs differ",
};

/** Trigger labels wide enough that the progress bar has to give way on narrower toolbars. */
const LONG_FILTER_LABELS: ReadonlySet<ReviewFilter> = new Set(["attention", "incorrect", "runsDisagree"]);

export type ToolbarSection = {
  /** Pending rows; null for sections without a count (Notes). */
  count: number | null;
  /** Every row decided: a success check instead of the count. */
  done: boolean;
  id: string;
  label: string;
  /** The count is not a pending count (Runs): shown muted, never as a check. */
  neutralCount?: boolean;
};

export type ToolbarProgress = {
  confirmed: number;
  corrected: number;
  pending: number;
  total: number;
};

export type ReviewToolbarProps = {
  activeSectionId: string | null;
  /** Shown at xl while the datasheet pane is collapsed. */
  datasheetButton?: { onClick: () => void } | null;
  filter: ReviewFilter;
  filterOptions: ReadonlyArray<{ count: number; value: ReviewFilter }>;
  onFilterChange: (filter: ReviewFilter) => void;
  onNext: () => void;
  onProgressClick: () => void;
  onSectionClick: (id: string) => void;
  progress: ToolbarProgress;
  sections: readonly ToolbarSection[];
  /** Re-runs: "Show baseline values" toggle in the filter menu. */
  showBaselineValues?: { onChange: (value: boolean) => void; value: boolean } | null;
};

function SectionLink({
  active,
  onSelect,
  section,
}: {
  active: boolean;
  onSelect: (id: string) => void;
  section: ToolbarSection;
}) {
  return (
    <li className="flex h-full shrink-0">
      <a
        aria-current={active ? "location" : undefined}
        className={cn(
          "relative inline-flex h-full items-center gap-1 rounded-xs px-1.25 text-callout 2xl:gap-1.5 2xl:px-2 font-medium whitespace-nowrap outline-offset-[-4px] transition-colors duration-(--ui-duration-fast) ease-ui",
          "after:absolute after:inset-x-1.25 after:bottom-0 2xl:after:inset-x-2 after:h-0.5 after:rounded-pill after:transition-colors after:duration-(--ui-duration-fast)",
          active
            ? "text-text after:bg-accent"
            : "text-text-muted after:bg-transparent hover:text-text",
        )}
        href={`#${section.id}`}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onSelect(section.id);
        }}
      >
        {section.label}
        {section.done && !section.neutralCount ? (
          <>
            <Check aria-hidden="true" className="size-3 text-success" strokeWidth={3} />
            <span className="sr-only">, all decided</span>
          </>
        ) : section.count !== null && section.count > 0 ? (
          <span
            className={cn(
              "text-caption tabular-nums",
              section.neutralCount ? "text-text-muted" : "text-text-muted",
            )}
          >
            {section.count}
            {section.neutralCount ? null : <span className="sr-only"> pending</span>}
          </span>
        ) : null}
      </a>
    </li>
  );
}

function buildFilterItems({
  filter,
  filterOptions,
  onFilterChange,
  showBaselineValues,
}: Pick<ReviewToolbarProps, "filter" | "filterOptions" | "onFilterChange" | "showBaselineValues">) {
  const items: MenuEntry[] = filterOptions.map((option) => ({
    icon:
      option.value === filter ? (
        <Check className="text-accent" strokeWidth={2.5} />
      ) : (
        <span className="block size-4" />
      ),
    label: REVIEW_FILTER_LABELS[option.value],
    onSelect: () => onFilterChange(option.value),
    shortcut: String(option.count),
  }));

  if (showBaselineValues) {
    items.push("separator", {
      icon: showBaselineValues.value ? (
        <Check className="text-accent" strokeWidth={2.5} />
      ) : (
        <span className="block size-4" />
      ),
      label: "Show baseline values",
      onSelect: () => showBaselineValues.onChange(!showBaselineValues.value),
    });
  }

  return items;
}

/**
 * Sticky review toolbar under the header (§4.3): section links with
 * scroll-spy, the filter menu, the progress capsule and Next. Below 768 px it
 * keeps the section links and a filter icon; progress and Next move to the
 * bottom bar.
 */
export function ReviewToolbar({
  activeSectionId,
  datasheetButton,
  filter,
  filterOptions,
  onFilterChange,
  onNext,
  onProgressClick,
  onSectionClick,
  progress,
  sections,
  showBaselineValues,
}: ReviewToolbarProps) {
  const decided = progress.total - progress.pending;
  const filterLabel = REVIEW_FILTER_LABELS[filter];
  const filtered = filter !== "all";
  const items = buildFilterItems({ filter, filterOptions, onFilterChange, showBaselineValues });

  return (
    <div className="@container/toolbar sticky top-(--ui-header-height) z-20 border-b border-border bg-material backdrop-blur-[20px] backdrop-saturate-[1.8]">
      <div className="flex h-(--ui-toolbar-height) items-center gap-2 pr-3 pl-2 md:pr-3 md:pl-2.5 2xl:gap-3 2xl:pr-4 2xl:pl-4">
        <nav
          aria-label="Review sections"
          className="relative h-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex h-full items-stretch">
            {sections.map((section) => (
              <SectionLink
                active={section.id === activeSectionId}
                key={section.id}
                onSelect={onSectionClick}
                section={section}
              />
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {datasheetButton ? (
            <Button
              className="max-xl:hidden"
              id={DATASHEET_OPEN_BUTTON_ID}
              onClick={datasheetButton.onClick}
              size="sm"
              variant="ghost"
            >
              <PanelRightOpen aria-hidden="true" />
              Datasheet
            </Button>
          ) : null}

          <div className="max-md:hidden">
            <Menu
              align="end"
              items={items}
              label="Filter rows"
              minWidth={232}
              trigger={
                <Button
                  aria-label={`Filter: ${filterLabel}`}
                  className={filtered ? "text-accent-text!" : undefined}
                  size="sm"
                  variant="secondary"
                >
                  <ListFilter aria-hidden="true" />
                  <span className="hidden @min-[860px]/toolbar:inline">Filter:</span>
                  <span>{SHORT_FILTER_LABELS[filter]}</span>
                  <ChevronDown aria-hidden="true" className="text-text-muted" />
                </Button>
              }
            />
          </div>

          <div className="md:hidden">
            <Menu
              align="end"
              items={items}
              label="Filter rows"
              minWidth={232}
              trigger={
                <IconButton
                  className={filtered ? "text-accent-text!" : undefined}
                  icon={
                    <span className="relative flex">
                      <ListFilter />
                      {filtered ? (
                        <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-pill bg-accent" />
                      ) : null}
                    </span>
                  }
                  label={`Filter: ${filterLabel}`}
                  tooltip={false}
                />
              }
            />
          </div>

          <Tooltip
            content={`${progress.confirmed} confirmed · ${progress.corrected} corrected · ${progress.pending} pending`}
            describeChild={false}
          >
            <button
              aria-label={`${decided} of ${progress.total} decided. Show pending rows`}
              className="inline-flex h-7 shrink-0 items-center gap-2 rounded-sm px-1.5 text-callout whitespace-nowrap text-text-muted transition-colors duration-(--ui-duration-fast) ease-ui hover:bg-surface-hover hover:text-text max-md:hidden"
              onClick={onProgressClick}
              type="button"
            >
              <ProgressBar
                // Shown from a 620 px toolbar (1366 px and up with the pane
                // open). The longer filter labels ("Runs differ", "Attention")
                // need that room for the section links until 780 px.
                className={cn(
                  "w-12! @min-[860px]/toolbar:w-16!",
                  LONG_FILTER_LABELS.has(filter)
                    ? "@max-[779px]/toolbar:hidden"
                    : "@max-[619px]/toolbar:hidden",
                )}
                label="Review progress"
                segments={[
                  { tone: "success", value: progress.confirmed },
                  { tone: "danger", value: progress.corrected },
                ]}
                total={progress.total}
                variant="sm"
              />
              <span className="tabular-nums">
                {decided} / {progress.total}
              </span>
            </button>
          </Tooltip>

          <NextButton
            className="max-md:hidden"
            label={<span className="@max-[719px]/toolbar:sr-only">Next</span>}
            onNext={onNext}
            pending={progress.pending}
          />
        </div>
      </div>
    </div>
  );
}

export function NextButton({
  className,
  label = "Next",
  onNext,
  pending,
}: {
  className?: string;
  label?: ReactNode;
  onNext: () => void;
  pending: number;
}) {
  return (
    <Tooltip content={pending > 0 ? `Next pending · ${pending}` : "Nothing left to decide"} describeChild={false}>
      <Button
        aria-disabled={pending === 0 || undefined}
        aria-keyshortcuts="N"
        aria-label={pending > 0 ? `Next pending row, ${pending} left` : "Next pending row, none left"}
        className={cn(pending === 0 && "text-text-tertiary!", className)}
        onClick={() => {
          if (pending > 0) {
            onNext();
          }
        }}
        size="sm"
        variant="secondary"
      >
        <ArrowDownToLine aria-hidden="true" />
        {label}
      </Button>
    </Tooltip>
  );
}
