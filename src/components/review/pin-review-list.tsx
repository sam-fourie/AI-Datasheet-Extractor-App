"use client";

import { memo, useMemo, type ReactNode } from "react";

import { Card, SearchField, cn } from "@/components/ui";
import { describeRunHint } from "@/lib/submissions/agreement";
import { groupPinsByEvidencePage, normalizeEvidencePages } from "@/lib/submissions/evidence";
import {
  buildSubmissionResolvedView,
  classifyRowAttention,
  countDecisionsForRows,
  countSectionDecisions,
  pinRowKey,
  planBulkConfirm,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import { createAttentionContextResolver } from "@/lib/submissions/review-filters";
import type {
  BaselineRunHints,
  ExtractionSnapshot,
  ResolvedPinRow,
  SubmissionAgreementRow,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

import { AttentionMarker, attentionToneFor, describeReasonsForName } from "./attention-marker";
import { BaselineCompareLine } from "./baseline-compare-line";
import { CorrectionEditor } from "./correction-editor";
import { DecisionGlyph } from "./decision-glyph";
import { EvidenceChips } from "./evidence-chips";
import { PinGroupHeader } from "./pin-group-header";
import { ReviewRow } from "./review-row";
import {
  BulkConfirmButton,
  FilteredOutNote,
  FilteredOutSectionNote,
  formatDecidedCount,
  ReviewSection,
} from "./review-section";
import {
  isRowVisible,
  PIN_SEARCH_INPUT_ID,
  REVIEW_SECTION_IDS,
  type ReviewListProps,
  type ReviewRowCallbacks,
} from "./types";

/** The pin search field appears when there are more than this many pins (§4.3). */
export const PIN_SEARCH_THRESHOLD = 24;

export type PinReviewListProps = ReviewListProps & {
  className?: string;
  /**
   * Controlled pin search ("Find pin", "/" focuses it). Rendered only when
   * there are more than 24 pins. The list does NOT filter by it: fold the
   * query into `visibility.isVisible` (see computeVisibleRows / pinMatchesQuery)
   * so J/K order and bulk scopes see the same rows.
   */
  search?: {
    onChange: (value: string) => void;
    /** "/" by default; null when single-key shortcuts are turned off. */
    shortcutKey?: string | null;
    value: string;
  } | null;
};

/**
 * Pin display order: grouped order when the list is grouped (> 16 pins with
 * evidence), else extraction order. Pass it to computeVisibleRows as pinOrder.
 */
export function getPinDisplayOrder(pins: Parameters<typeof groupPinsByEvidencePage>[0]): number[] {
  const groups = groupPinsByEvidencePage(pins);

  return groups ? groups.flatMap((group) => group.pinIndexes) : pins.map((_, index) => index);
}

const pinGrid = cn(
  "grid min-h-12 items-center gap-x-2 px-4 py-[5px] md:min-h-10 sm:gap-x-3",
  "grid-cols-[20px_40px_minmax(0,1fr)_auto_auto] sm:grid-cols-[20px_56px_minmax(0,1fr)_auto_auto]",
);

function PinName({ row }: { row: ResolvedPinRow }) {
  return (
    <>
      <p className="font-mono text-callout break-words text-text">{row.pinName}</p>
      {row.isCorrected ? (
        <p className="text-caption text-text-muted">
          AI:{" "}
          <span className="font-mono line-through">
            {row.originalPinNumber !== row.pinNumber ? `${row.originalPinNumber} · ` : ""}
            {row.originalPinName}
          </span>
        </p>
      ) : null}
      {row.isCorrected && row.correctionNote ? (
        <p className="text-caption break-words text-text-muted">“{row.correctionNote}”</p>
      ) : null}
    </>
  );
}

type PinRowItemProps = {
  agreementRow: SubmissionAgreementRow | null;
  callbacks: ReviewRowCallbacks;
  contextFor: ReturnType<typeof createAttentionContextResolver>;
  divider: boolean;
  extraction: ExtractionSnapshot;
  interactive: boolean;
  isActive: boolean;
  isEditing: boolean;
  isStickyOnly: boolean;
  isTabStop: boolean;
  last: boolean;
  pdfAvailable: boolean;
  /** The draft, only while this row's correction editor is open; null otherwise. */
  review: SubmissionHumanReview | null;
  row: ResolvedPinRow;
  runHints: BaselineRunHints | null;
  showBaselineValues: boolean;
  showChips: boolean;
};

/**
 * `row` is rebuilt from the draft on every change, so it is compared field by
 * field; every other prop by identity. With stable callbacks from the
 * workspace, moving the active row re-renders only the two rows involved.
 */
function arePinRowPropsEqual(previous: PinRowItemProps, next: PinRowItemProps) {
  for (const key of Object.keys(next) as Array<keyof PinRowItemProps>) {
    if (key === "row") {
      if (!shallowEqual(previous.row, next.row)) {
        return false;
      }
    } else if (!Object.is(previous[key], next[key])) {
      return false;
    }
  }

  return true;
}

function shallowEqual<T extends object>(a: T, b: T) {
  if (a === b) {
    return true;
  }

  const keys = Object.keys(a) as Array<keyof T>;

  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]))
  );
}

/** One pin row. Memoised: a list of 100+ pins must not re-render on every keypress. */
const PinRowItem = memo(function PinRowItem({
  agreementRow,
  callbacks,
  contextFor,
  divider,
  extraction,
  interactive,
  isActive,
  isEditing,
  isStickyOnly,
  isTabStop,
  last,
  pdfAvailable,
  review,
  row,
  runHints,
  showBaselineValues,
  showChips,
}: PinRowItemProps) {
  const pinIndex = row.pinIndex;
  const ref: ReviewRowRef = { kind: "pin", pinIndex };
  const key = pinRowKey(pinIndex);
  const reasons = classifyRowAttention(extraction, ref, contextFor(ref));
  const runHintText = describeRunHint(runHints?.[key]);
  const decision = row.reviewStatus;
  const pages = normalizeEvidencePages(row.evidencePages);
  const showPage = pdfAvailable ? callbacks.onShowPage : undefined;
  const subject = `pin ${row.originalPinNumber}, ${row.originalPinName}`;
  const statusText =
    decision === "corrected" ? `corrected to ${row.pinNumber}, ${row.pinName}` : decision;
  const accessibleName = [
    `Pin ${row.originalPinNumber}, ${row.originalPinName}`,
    statusText,
    describeReasonsForName(reasons, runHintText),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <ReviewRow
      accessibleName={accessibleName}
      callbacks={callbacks}
      className={cn(last && "rounded-b-md")}
      contentVisibility
      decision={decision}
      divider={divider}
      editor={
        isEditing && review ? (
          <CorrectionEditor
            callbacks={callbacks}
            className={last ? "rounded-b-md" : undefined}
            extraction={extraction}
            key={key}
            review={review}
            rowRef={ref}
            subject={subject}
          />
        ) : null
      }
      gridClassName={pinGrid}
      interactive={interactive}
      isActive={isActive}
      isEditing={isEditing}
      isStickyOnly={isStickyOnly}
      isTabStop={isTabStop}
      rowRef={ref}
      subject={subject}
    >
      <DecisionGlyph decision={decision} />
      <span className="truncate text-right font-mono text-callout text-text-muted tabular-nums">
        {row.pinNumber}
      </span>
      <div className="min-w-0">
        <PinName row={row} />
        <BaselineCompareLine row={agreementRow} showMatches={showBaselineValues} />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {showChips ? (
          <EvidenceChips
            maxChips={2}
            onShowPage={showPage ? (page) => showPage(page, ref) : undefined}
            pages={pages}
            tabbable={isTabStop || isActive}
          />
        ) : null}
        <AttentionMarker
          reasons={reasons}
          runHintText={runHintText}
          tone={attentionToneFor(reasons, agreementRow?.outcome)}
          variant="compact"
        />
      </div>
    </ReviewRow>
  );
}, arePinRowPropsEqual);

/**
 * The Pins section (§4.3 item 8, §5.2). More than 16 pins with evidence pages
 * are grouped by first evidence page under sticky PinGroupHeaders; otherwise a
 * flat list. The search field shows above 24 pins. Bulk buttons (edit mode
 * only) cover the visible rows of each group, or of the flat list.
 */
export function PinReviewList({
  activeKey,
  callbacks,
  className,
  comparison,
  editingKey,
  extraction,
  mode,
  pdfAvailable = true,
  review,
  runHints,
  search,
  tabStopKey,
  visibility,
}: PinReviewListProps) {
  const interactive = mode === "edit";
  // Explicit memos: the compiler folds the rest of this body into one scope
  // keyed on activeKey, and the memoised rows need these two to keep their
  // identity when only the active row changes.
  const resolved = useMemo(
    () => buildSubmissionResolvedView({ extraction, review }).pinRows,
    [extraction, review],
  );
  const contextFor = useMemo(
    () => createAttentionContextResolver({ comparison, runHints }),
    [comparison, runHints],
  );
  const counts = countSectionDecisions(review).pins;
  const stopKey = tabStopKey === undefined ? activeKey : tabStopKey;
  const groups = groupPinsByEvidencePage(extraction.pinRows);
  const showPage = pdfAvailable ? callbacks.onShowPage : undefined;

  function isShown(pinIndex: number) {
    const key = pinRowKey(pinIndex);
    const sticky = visibility?.stickyKeys?.has(key) ?? false;
    const matches = isRowVisible(visibility, key);

    return { matches, shown: matches || sticky, sticky };
  }

  function renderRow(pinIndex: number, options: { divider: boolean; groupPage: number | null; last: boolean }) {
    const row = resolved[pinIndex];
    const key = pinRowKey(pinIndex);
    const { matches, sticky } = isShown(pinIndex);
    const pages = normalizeEvidencePages(row.evidencePages);
    const isEditing = editingKey === key;

    return (
      <PinRowItem
        agreementRow={comparison?.agreementByKey.get(key) ?? null}
        callbacks={callbacks}
        contextFor={contextFor}
        divider={options.divider}
        extraction={extraction}
        interactive={interactive}
        isActive={activeKey === key}
        isEditing={isEditing}
        isStickyOnly={sticky && !matches}
        isTabStop={stopKey === key}
        key={key}
        last={options.last}
        pdfAvailable={pdfAvailable}
        // Only the row with the open editor depends on the whole draft, so
        // typing notes or deciding another row never re-renders this one.
        review={isEditing ? review : null}
        row={row}
        runHints={runHints ?? null}
        showBaselineValues={comparison?.showBaselineValues ?? false}
        showChips={groups === null || !(pages.length === 1 && pages[0] === options.groupPage)}
      />
    );
  }

  const visibleFlat = extraction.pinRows.map((_, pinIndex) => pinIndex).filter((index) => isShown(index).shown);
  const query = search?.value.trim() ?? "";

  const flatPlan =
    interactive && groups === null
      ? planBulkConfirm(
          extraction,
          review,
          visibleFlat.map((pinIndex) => ({ kind: "pin" as const, pinIndex })),
          contextFor,
        )
      : null;

  const actions =
    (search && extraction.pinRows.length > PIN_SEARCH_THRESHOLD) || flatPlan ? (
      <>
        {flatPlan ? (
          <BulkConfirmButton
            onConfirm={(refs) => callbacks.onBulkConfirm(refs, { kind: "pins" })}
            plan={flatPlan}
          />
        ) : null}
        {search && extraction.pinRows.length > PIN_SEARCH_THRESHOLD ? (
          <SearchField
            aria-label="Find pin"
            className="w-full min-[420px]:w-48"
            id={PIN_SEARCH_INPUT_ID}
            onChange={search.onChange}
            placeholder="Find pin"
            shortcutKey={search.shortcutKey === undefined ? "/" : (search.shortcutKey ?? undefined)}
            value={search.value}
          />
        ) : null}
      </>
    ) : null;

  let body: ReactNode;

  if (extraction.pinRows.length === 0) {
    body = <FilteredOutNote>No pins were extracted.</FilteredOutNote>;
  } else if (visibleFlat.length === 0) {
    body = query ? (
      <FilteredOutNote>No pins match “{query}”.</FilteredOutNote>
    ) : (
      <FilteredOutSectionNote
        filter={visibility?.filter}
        onShowAll={callbacks.onShowAll}
        section="pins"
      />
    );
  } else if (groups === null) {
    body = visibleFlat.map((pinIndex, index) =>
      renderRow(pinIndex, {
        divider: index > 0,
        groupPage: null,
        last: index === visibleFlat.length - 1,
      }),
    );
  } else {
    const visibleGroups = groups
      .map((group) => ({ ...group, visible: group.pinIndexes.filter((index) => isShown(index).shown) }))
      .filter((group) => group.visible.length > 0);

    body = visibleGroups.map((group, groupIndex) => {
      const headingId = `pin-group-${group.key}`;
      const groupCounts = countDecisionsForRows(
        review,
        group.pinIndexes.map((pinIndex) => ({ kind: "pin" as const, pinIndex })),
      );
      const plan = interactive
        ? planBulkConfirm(
            extraction,
            review,
            group.visible.map((pinIndex) => ({ kind: "pin" as const, pinIndex })),
            contextFor,
          )
        : null;
      const lastGroup = groupIndex === visibleGroups.length - 1;

      return (
        <div aria-labelledby={headingId} key={group.key} role="group">
          <PinGroupHeader
            bulk={
              plan
                ? {
                    onConfirm: (refs) => callbacks.onBulkConfirm(refs, { kind: "pin-group", page: group.page }),
                    plan,
                  }
                : null
            }
            className={groupIndex === 0 ? "rounded-t-md" : "border-t"}
            headingId={headingId}
            onShowPage={showPage ? (page) => showPage(page) : undefined}
            page={group.page}
            pendingCount={groupCounts.pending}
            pinCount={group.pinIndexes.length}
          />
          {group.visible.map((pinIndex, index) =>
            renderRow(pinIndex, {
              divider: index > 0,
              groupPage: group.page,
              last: lastGroup && index === group.visible.length - 1,
            }),
          )}
        </div>
      );
    });
  }

  return (
    <ReviewSection
      actions={actions}
      className={className}
      id={REVIEW_SECTION_IDS.pins}
      meta={counts.total > 0 ? formatDecidedCount(counts) : null}
      title="Pins"
    >
      <Card className="@container/review" padding="none">
        {body}
      </Card>
    </ReviewSection>
  );
}
