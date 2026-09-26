/**
 * Workspace-facing contracts for the review building blocks.
 *
 * The review workspace owns all state (draft review, active row, open
 * correction editor, filter, search, sticky keys) and passes it down. The
 * components in this folder are controlled and presentational: they render
 * rows from that state and report intent through `ReviewRowCallbacks`.
 *
 * This file only holds UI contracts: callback and prop types, DOM ids and
 * labels. Review rules (attention, filters, bulk eligibility, corrections,
 * counting, agreement mapping) live in `src/lib/submissions/review.ts`,
 * `review-filters.ts`, `evidence.ts` and `agreement.ts`.
 */

import type { CorrectionInput, ReviewMode, ReviewRowRef } from "@/lib/submissions/review";
import type { FilteredSection, ReviewFilter } from "@/lib/submissions/review-filters";
import type {
  BaselineRunHints,
  ExtractionSnapshot,
  SubmissionAgreementRow,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

export type { CorrectionInput, ReviewMode, ReviewRowRef };

/* ------------------------------ Callbacks ---------------------------------- */

/** Which bulk "Confirm N high-confidence" button was used. */
export type BulkConfirmScope =
  | { kind: "measurements" }
  | { kind: "pins" }
  | { kind: "pin-group"; page: number | null };

export type ApplyCorrectionOptions = {
  /** True for ⌘Enter / Ctrl+Enter: apply, then move to the next pending row. */
  advance: boolean;
};

/**
 * Everything a row, list or editor can ask the workspace to do. Pass an object
 * whose identity never changes (the workspace builds it once and forwards each
 * call to its latest handlers through a ref): pin rows are memoised on their
 * props, so a new callbacks object would re-render every row.
 */
export type ReviewRowCallbacks = {
  /** A row was clicked or received focus. Make it the active row. */
  onActivate: (ref: ReviewRowRef) => void;
  /**
   * Confirm segment or "Confirm instead". `status` is "pending" when the
   * reviewer clicked Confirm on an already confirmed row. The workspace calls
   * `setDecision(draft, ref, status)` and closes any open editor on that row.
   */
  onDecide: (ref: ReviewRowRef, status: "confirmed" | "pending") => void;
  /** Incorrect segment. Open the correction editor for this row (editingKey = rowKeyOf(ref)). */
  onOpenCorrection: (ref: ReviewRowRef) => void;
  /** Cancel, Esc, or Incorrect clicked while the editor is open. The draft is unchanged. */
  onCloseCorrection: (ref: ReviewRowRef) => void;
  /**
   * Apply (Enter) or apply-and-next (⌘Enter). The input is already valid
   * (`validateCorrection` returned null). The workspace calls
   * `applyCorrection(extraction, draft, ref, input)`, closes the editor and,
   * when `options.advance`, activates the next pending row.
   */
  onApplyCorrection: (
    ref: ReviewRowRef,
    input: CorrectionInput,
    options: ApplyCorrectionOptions,
  ) => void;
  /** "Remove correction" on an already corrected row: back to pending. */
  onRemoveCorrection: (ref: ReviewRowRef) => void;
  /**
   * The open editor's input differs (true) or no longer differs (false) from
   * the values it opened with. Drives "1 correction not applied · Go to".
   * Also called with false when the editor unmounts.
   */
  onCorrectionDraftChange?: (ref: ReviewRowRef, hasUnappliedInput: boolean) => void;
  /** Show the datasheet at a 1-based page (evidence chip, group "Show page"). */
  onShowPage: (page: number, ref?: ReviewRowRef) => void;
  /** A bulk button was pressed. `refs` are exactly the eligible visible rows. */
  onBulkConfirm: (refs: ReviewRowRef[], scope: BulkConfirmScope) => void;
  /**
   * "Show all" in a section the filter emptied. The workspace resets the
   * filter to All and focuses that section's first row, because the button
   * is gone once the rows are back.
   */
  onShowAll: (section: FilteredSection) => void;
};

/* ------------------------------ Row state ---------------------------------- */

/**
 * Filter visibility for the lists. A row renders when neither `visibleKeys`
 * nor `isVisible` is given, when it is in `visibleKeys` (or `isVisible`
 * returns true), or when its key is in `stickyKeys` (rows decided while the
 * filter excludes them stay visible until the filter changes, §5.3). Prefer
 * `visibleKeys`: a Set keeps its identity across renders, a closure does not.
 */
export type RowVisibility = {
  /** The active filter, for the note shown when it hides a whole section. */
  filter?: ReviewFilter;
  isVisible?: (rowKey: string) => boolean;
  stickyKeys?: ReadonlySet<string>;
  visibleKeys?: ReadonlySet<string>;
};

/** Whether the filter and search match a row (sticky rows aside). */
export function isRowVisible(visibility: RowVisibility | undefined, rowKey: string) {
  if (visibility?.visibleKeys) {
    return visibility.visibleKeys.has(rowKey);
  }

  return visibility?.isVisible ? visibility.isVisible(rowKey) : true;
}

/** Re-run pages: how each row of THIS run compares with the baseline. */
export type RowComparisonContext = {
  /** Agreement rows keyed by the re-run's own row key (indexAgreementRowsByRerunKey in agreement.ts). */
  agreementByKey: ReadonlyMap<string, SubmissionAgreementRow>;
  /** "Show baseline values": compare lines on matching rows too. */
  showBaselineValues: boolean;
};

/** Props shared by PackageReviewBlock, MeasurementReviewList and PinReviewList. */
export type ReviewListProps = {
  /** Key of the active row (rowKeyOf), or null. */
  activeKey: string | null;
  callbacks: ReviewRowCallbacks;
  /** Re-run pages only. */
  comparison?: RowComparisonContext | null;
  /** Key of the row whose correction editor is open, or null. */
  editingKey: string | null;
  extraction: ExtractionSnapshot;
  /** "edit" renders decision toggles and bulk buttons; "read" renders static labels. */
  mode: ReviewMode;
  /** False when the PDF can't be shown: evidence chips render as plain text. Default true. */
  pdfAvailable?: boolean;
  /** The DRAFT review. */
  review: SubmissionHumanReview;
  /** Baseline pages only: buildBaselineRunHints(runs). */
  runHints?: BaselineRunHints | null;
  /**
   * Key of the one row that is in the tab order (roving tabindex). The
   * workspace passes activeKey, or the first visible row when nothing is
   * active. Defaults to activeKey.
   */
  tabStopKey?: string | null;
  visibility?: RowVisibility;
};

/* ------------------------------ DOM ids ------------------------------------ */

export const REVIEW_SECTION_IDS = {
  measurements: "section-measurements",
  notes: "section-notes",
  package: "section-package",
  pins: "section-pins",
  runs: "section-runs",
} as const;

export type ReviewSectionId = (typeof REVIEW_SECTION_IDS)[keyof typeof REVIEW_SECTION_IDS];

/** Id of the pin search input (for the "/" shortcut and "Go to"). */
export const PIN_SEARCH_INPUT_ID = "review-pin-search";

/** The pane's "Hide datasheet" button (focus lands here after the pane opens). */
export const DATASHEET_HIDE_BUTTON_ID = "review-datasheet-hide";

/** The toolbar's "Datasheet" button (focus lands here after the pane collapses). */
export const DATASHEET_OPEN_BUTTON_ID = "review-datasheet-open";

/** Id of the reviewer notes textarea. */
export const REVIEWER_NOTES_INPUT_ID = "review-reviewer-notes";

export function slugifyField(field: string) {
  const slug = field
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "field";
}

/** "row-package", "row-m-body-length" or "row-pin-7" (§5.2). */
export function rowDomId(ref: ReviewRowRef) {
  switch (ref.kind) {
    case "package":
      return "row-package";
    case "measurement":
      return `row-m-${slugifyField(ref.field)}`;
    case "pin":
      return `row-pin-${ref.pinIndex}`;
  }
}

/** The correction editor region under a row. */
export function correctionEditorDomId(ref: ReviewRowRef) {
  return `${rowDomId(ref)}-correction`;
}

/** The editor's first input; focus it for "1 correction not applied · Go to". */
export function correctionInputDomId(ref: ReviewRowRef) {
  return `${rowDomId(ref)}-correction-input`;
}

/**
 * Resolves a location hash ("#row-m-body-length", "#row-pin-7",
 * "#row-package") back to a row ref of this extraction, or null.
 */
export function rowRefFromDomId(
  extraction: ExtractionSnapshot,
  domId: string,
): ReviewRowRef | null {
  const id = domId.replace(/^#/, "");

  if (id === "row-package") {
    return { kind: "package" };
  }

  const pinMatch = id.match(/^row-pin-(\d+)$/);

  if (pinMatch) {
    const pinIndex = Number.parseInt(pinMatch[1], 10);

    return pinIndex < extraction.pinRows.length ? { kind: "pin", pinIndex } : null;
  }

  if (id.startsWith("row-m-")) {
    const field = extraction.fields.find((row) => rowDomId({ field: row.field, kind: "measurement" }) === id);

    return field ? { field: field.field, kind: "measurement" } : null;
  }

  return null;
}

/* ------------------------------ Filters ------------------------------------ */

/** Filter menu labels. The filter rules live in src/lib/submissions/review-filters.ts. */
export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "All",
  attention: "Needs attention",
  differs: "Differs from baseline",
  incorrect: "Incorrect",
  pending: "Pending",
  runsDisagree: "Runs disagree",
};
