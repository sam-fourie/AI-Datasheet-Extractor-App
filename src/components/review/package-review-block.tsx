"use client";

import { Card, cn } from "@/components/ui";
import { describeRunHint } from "@/lib/submissions/agreement";
import { getPackageEvidencePage } from "@/lib/submissions/evidence";
import {
  buildSubmissionResolvedView,
  classifyRowAttention,
  PACKAGE_ROW_KEY,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import { createAttentionContextResolver } from "@/lib/submissions/review-filters";

import { AttentionMarker, attentionToneFor, describeReasonsForName } from "./attention-marker";
import { BaselineCompareLine } from "./baseline-compare-line";
import { CorrectionEditor } from "./correction-editor";
import { DecisionGlyph } from "./decision-glyph";
import { EvidenceChips } from "./evidence-chips";
import { ReviewRow } from "./review-row";
import { FilteredOutSectionNote, formatDecidedCount, ReviewSection } from "./review-section";
import { isRowVisible, REVIEW_SECTION_IDS, type ReviewListProps } from "./types";

export type PackageReviewBlockProps = ReviewListProps & {
  className?: string;
};

const PACKAGE_REF: ReviewRowRef = { kind: "package" };

const packageGrid = cn(
  "grid min-h-[72px] items-center gap-x-3 gap-y-1 px-4 py-3",
  "grid-cols-[20px_minmax(0,1fr)_auto] [grid-template-areas:'glyph_main_decision'_'._meta_meta']",
  "md:[grid-template-areas:'glyph_main_decision'_'._meta_decision']",
);

/**
 * The Package section (§4.3 item 6): one card row with the selected package
 * at 17/600, "Also considered: …", the evidence chip, attention marker and
 * decision toggle. Hidden entirely when the filter excludes the package row
 * (unless it is sticky).
 */
export function PackageReviewBlock({
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
}: PackageReviewBlockProps) {
  const key = PACKAGE_ROW_KEY;
  const sticky = visibility?.stickyKeys?.has(key) ?? false;
  const matches = isRowVisible(visibility, key);

  const resolved = buildSubmissionResolvedView({ extraction, review }).packageSelection;
  const decision = resolved.reviewStatus;
  const contextFor = createAttentionContextResolver({ comparison, runHints });
  const reasons = classifyRowAttention(extraction, PACKAGE_REF, contextFor(PACKAGE_REF));
  const runHintText = describeRunHint(runHints?.[key]);
  const agreementRow = comparison?.agreementByKey.get(key) ?? null;
  const evidencePage = getPackageEvidencePage(extraction);
  const interactive = mode === "edit";
  const isActive = activeKey === key;
  const isTabStop = (tabStopKey === undefined ? activeKey : tabStopKey) === key;
  const alternatives = extraction.packageSelection.alternatives.filter(
    (option) => option.trim() && option.trim() !== resolved.originalSelectedPackage.trim(),
  );

  const statusText =
    decision === "corrected"
      ? `corrected to ${resolved.selectedPackage}`
      : decision === "confirmed"
        ? "confirmed"
        : "pending";
  const accessibleName = [
    `Package, AI selection ${resolved.originalSelectedPackage}`,
    statusText,
    describeReasonsForName(reasons, runHintText),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <ReviewSection
      className={className}
      id={REVIEW_SECTION_IDS.package}
      meta={formatDecidedCount({ pending: decision === "pending" ? 1 : 0, total: 1 })}
      title="Package"
    >
      {matches || sticky ? (
        <Card className="@container/review" padding="none">
          <ReviewRow
            accessibleName={accessibleName}
            callbacks={callbacks}
            className="rounded-md"
            decision={decision}
            decisionClassName="[grid-area:decision]"
            editor={
              <CorrectionEditor
                callbacks={callbacks}
                className="rounded-b-md"
                extraction={extraction}
                key={key}
                review={review}
                rowRef={PACKAGE_REF}
                subject="Package"
              />
            }
            gridClassName={packageGrid}
            interactive={interactive}
            isActive={isActive}
            isEditing={editingKey === key}
            isStickyOnly={sticky && !matches}
            isTabStop={isTabStop}
            rowRef={PACKAGE_REF}
            subject="package"
          >
            <DecisionGlyph className="self-start md:self-center [grid-area:glyph]" decision={decision} />
            <div className="min-w-0 [grid-area:main]">
              <p className="text-title-3 break-words text-text">{resolved.selectedPackage}</p>
              {resolved.isCorrected ? (
                <p className="mt-0.5 text-caption text-text-muted">
                  AI: <span className="line-through">{resolved.originalSelectedPackage}</span>
                </p>
              ) : null}
              {resolved.isCorrected && resolved.correctionNote ? (
                <p className="mt-0.5 text-caption text-text-muted">“{resolved.correctionNote}”</p>
              ) : null}
              {alternatives.length > 0 ? (
                <p className="mt-0.5 text-callout text-text-muted">
                  Also considered: {alternatives.join(" · ")}
                </p>
              ) : null}
              <BaselineCompareLine
                className="mt-1"
                row={agreementRow}
                showMatches={comparison?.showBaselineValues}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 [grid-area:meta] empty:hidden">
              {evidencePage !== null ? (
                <EvidenceChips
                  onShowPage={pdfAvailable ? (page) => callbacks.onShowPage(page, PACKAGE_REF) : undefined}
                  pages={[evidencePage]}
                  tabbable={isTabStop || isActive}
                />
              ) : null}
              <AttentionMarker
                reasons={reasons}
                runHintText={runHintText}
                tone={attentionToneFor(reasons, agreementRow?.outcome)}
              />
            </div>
          </ReviewRow>
        </Card>
      ) : (
        <Card padding="none">
          <FilteredOutSectionNote
            filter={visibility?.filter}
            onShowAll={callbacks.onShowAll}
            section="package"
          />
        </Card>
      )}
    </ReviewSection>
  );
}
