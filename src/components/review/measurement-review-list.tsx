"use client";

import { Card, cn } from "@/components/ui";
import { describeRunHint } from "@/lib/submissions/agreement";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import {
  buildSubmissionResolvedView,
  classifyRowAttention,
  countSectionDecisions,
  measurementRowKey,
  planBulkConfirm,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import { createAttentionContextResolver } from "@/lib/submissions/review-filters";
import type { ResolvedMeasurementRow } from "@/lib/submissions/types";

import { AttentionMarker, attentionToneFor, describeReasonsForName } from "./attention-marker";
import { BaselineCompareLine } from "./baseline-compare-line";
import { CorrectionEditor } from "./correction-editor";
import { DecisionGlyph } from "./decision-glyph";
import { EvidenceChips } from "./evidence-chips";
import { ReviewRow } from "./review-row";
import {
  BulkConfirmButton,
  FilteredOutNote,
  FilteredOutSectionNote,
  formatDecidedCount,
  ReviewSection,
} from "./review-section";
import { isRowVisible, REVIEW_SECTION_IDS, type ReviewListProps } from "./types";

export type MeasurementReviewListProps = ReviewListProps & {
  className?: string;
};

/*
 * Desktop (md+): glyph · name (+ meta line) · value · decision.
 * Mobile: line 1 glyph · name · decision, line 2 value, line 3 evidence and
 * attention (§5.2 "two-line" rows; meta wraps under the value).
 */
const measurementGrid = cn(
  "grid min-h-[52px] items-center gap-x-3 gap-y-1 px-4 py-2.5",
  "grid-cols-[20px_minmax(0,1fr)_auto] [grid-template-areas:'glyph_name_decision'_'._value_value'_'._meta_meta']",
  // Desktop: the name and its meta line stay together, vertically centred
  // against a value that may wrap (the 1fr rows absorb the extra height).
  "md:grid-cols-[20px_minmax(140px,0.9fr)_minmax(0,1.2fr)_auto] md:grid-rows-[1fr_auto_auto_1fr] md:gap-y-0",
  "md:[grid-template-areas:'._._value_decision'_'glyph_name_value_decision'_'._meta_value_decision'_'._._value_decision']",
);

function isNotFoundText(value: string | undefined) {
  return value !== undefined && value.trim() === NOT_FOUND_VALUE;
}

function aiValueText(row: ResolvedMeasurementRow) {
  return row.originalStatus === "Not found" || isNotFoundText(row.originalValue)
    ? "not in datasheet"
    : row.originalValue;
}

function MeasurementValue({ row }: { row: ResolvedMeasurementRow }) {
  if (row.isCorrected) {
    const correctedNotFound = isNotFoundText(row.correctedValue) || row.correctedStatus === "Not found";

    return (
      <>
        <p
          className={cn(
            "text-[15px] leading-5 font-medium break-words tabular-nums md:text-body",
            correctedNotFound ? "italic text-text-muted" : "text-text",
          )}
        >
          {correctedNotFound ? "Not in datasheet" : row.correctedValue}
        </p>
        <p className="text-caption text-text-muted">
          AI:{" "}
          <span className="line-through">
            {row.originalStatus === "Not found" || isNotFoundText(row.originalValue)
              ? "Not in datasheet"
              : row.originalValue}
          </span>
        </p>
        {row.correctionNote ? (
          <p className="text-caption break-words text-text-muted">“{row.correctionNote}”</p>
        ) : null}
      </>
    );
  }

  if (row.originalStatus === "Not found" || isNotFoundText(row.originalValue)) {
    return <p className="text-[15px] leading-5 text-text-muted italic md:text-body">Not in datasheet</p>;
  }

  return (
    <p className="text-[15px] leading-5 break-words text-text tabular-nums md:text-body">{row.originalValue}</p>
  );
}

/**
 * The Measurements section (§4.3 item 7, §5.2): header with "8 of 10 decided"
 * and, in edit mode, "Confirm N high-confidence" over the visible rows; then
 * one card of measurement rows.
 */
export function MeasurementReviewList({
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
  tabStopKey,
  visibility,
}: MeasurementReviewListProps) {
  const interactive = mode === "edit";
  const resolved = buildSubmissionResolvedView({ extraction, review }).fields;
  const contextFor = createAttentionContextResolver({ comparison, runHints });
  const counts = countSectionDecisions(review).measurements;
  const stopKey = tabStopKey === undefined ? activeKey : tabStopKey;

  const rows = resolved
    .map((row) => {
      const ref: ReviewRowRef = { field: row.field, kind: "measurement" };
      const key = measurementRowKey(row.field);
      const sticky = visibility?.stickyKeys?.has(key) ?? false;
      const matches = isRowVisible(visibility, key);

      return { key, matches, ref, row, sticky };
    })
    .filter((entry) => entry.matches || entry.sticky);

  const plan = interactive
    ? planBulkConfirm(
        extraction,
        review,
        rows.map((entry) => entry.ref),
        contextFor,
      )
    : null;

  return (
    <ReviewSection
      actions={
        plan ? (
          <BulkConfirmButton
            onConfirm={(refs) => callbacks.onBulkConfirm(refs, { kind: "measurements" })}
            plan={plan}
          />
        ) : null
      }
      className={className}
      id={REVIEW_SECTION_IDS.measurements}
      meta={counts.total > 0 ? formatDecidedCount(counts) : null}
      title="Measurements"
    >
      <Card className="@container/review" padding="none">
        {resolved.length === 0 ? (
          <FilteredOutNote>No measurements were requested for this package.</FilteredOutNote>
        ) : rows.length === 0 ? (
          <FilteredOutSectionNote
            filter={visibility?.filter}
            onShowAll={callbacks.onShowAll}
            section="measurements"
          />
        ) : (
          rows.map(({ key, matches, ref, row, sticky }, index) => {
            const reasons = classifyRowAttention(extraction, ref, contextFor(ref));
            const runHintText = describeRunHint(runHints?.[key]);
            const decision = row.reviewStatus;
            const statusText =
              decision === "corrected"
                ? `corrected to ${isNotFoundText(row.correctedValue) ? "not in datasheet" : row.correctedValue}`
                : decision;
            const accessibleName = [
              `${row.field}, AI value ${aiValueText(row)}`,
              statusText,
              describeReasonsForName(reasons, runHintText),
            ]
              .filter(Boolean)
              .join(", ");
            const isActive = activeKey === key;
            const isTabStop = stopKey === key;

            return (
              <ReviewRow
                accessibleName={accessibleName}
                callbacks={callbacks}
                className={cn(
                  index === 0 && "rounded-t-md",
                  index === rows.length - 1 && "rounded-b-md",
                )}
                decision={decision}
                decisionClassName="[grid-area:decision]"
                divider={index > 0}
                editor={
                  <CorrectionEditor
                    callbacks={callbacks}
                    className={index === rows.length - 1 ? "rounded-b-md" : undefined}
                    extraction={extraction}
                    key={key}
                    review={review}
                    rowRef={ref}
                    subject={row.field}
                  />
                }
                gridClassName={measurementGrid}
                interactive={interactive}
                isActive={isActive}
                isEditing={editingKey === key}
                isStickyOnly={sticky && !matches}
                isTabStop={isTabStop}
                key={key}
                rowRef={ref}
                subject={row.field}
              >
                <DecisionGlyph className="[grid-area:glyph]" decision={decision} />
                <p className="min-w-0 text-[15px] leading-5 font-medium break-words text-text [grid-area:name] md:text-body">
                  {row.field}
                </p>
                <div className="min-w-0 [grid-area:value]">
                  <MeasurementValue row={row} />
                  <BaselineCompareLine
                    className="mt-0.5"
                    row={comparison?.agreementByKey.get(key)}
                    showMatches={comparison?.showBaselineValues}
                  />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 [grid-area:meta] empty:hidden md:mt-1">
                  <EvidenceChips
                    onShowPage={pdfAvailable ? (page) => callbacks.onShowPage(page, ref) : undefined}
                    pages={row.evidencePages}
                    tabbable={isTabStop || isActive}
                  />
                  <AttentionMarker
                    reasons={reasons}
                    runHintText={runHintText}
                    tone={attentionToneFor(reasons, comparison?.agreementByKey.get(key)?.outcome)}
                  />
                </div>
              </ReviewRow>
            );
          })
        )}
      </Card>
    </ReviewSection>
  );
}
