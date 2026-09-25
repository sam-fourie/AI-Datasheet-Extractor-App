import type { MeasurementFieldStatus } from "@/lib/package-categories";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import type {
  AgreementOutcome,
  BaselineRunHint,
  BaselineRunHints,
  ExtractionSnapshot,
  MeasurementReview,
  PackageSelectionReview,
  PinReview,
  ReviewDecisionCounts,
  ReviewDecisionStatus,
  ReviewProgress,
  SubmissionAccuracyBucket,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionResolvedView,
  SubmissionReviewStatus,
  SubmissionSummary,
} from "@/lib/submissions/types";

function trimToUndefined(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizePackageSelectionReview(
  review?: PackageSelectionReview,
): PackageSelectionReview {
  if (!review) {
    return {
      status: "pending",
    };
  }

  if (review.status !== "corrected") {
    return {
      status: review.status,
    };
  }

  const correctedSelectedPackage = trimToUndefined(review.correctedSelectedPackage);
  const correctionNote = trimToUndefined(review.correctionNote);

  return correctedSelectedPackage
    ? {
        correctionNote,
        correctedSelectedPackage,
        status: "corrected",
      }
    : {
        status: "pending",
      };
}

function normalizeMeasurementReview(
  field: string,
  review?: MeasurementReview,
): MeasurementReview {
  if (!review) {
    return {
      field,
      status: "pending",
    };
  }

  if (review.status !== "corrected") {
    return {
      field,
      status: review.status,
    };
  }

  const correctedValue = trimToUndefined(review.correctedValue);
  const correctionNote = trimToUndefined(review.correctionNote);

  return correctedValue
    ? {
        correctionNote,
        correctedStatus: review.correctedStatus,
        correctedValue,
        field,
        status: "corrected",
      }
    : {
        field,
        status: "pending",
      };
}

function normalizePinReview(pinIndex: number, review?: PinReview): PinReview {
  if (!review) {
    return {
      pinIndex,
      status: "pending",
    };
  }

  if (review.status !== "corrected") {
    return {
      pinIndex,
      status: review.status,
    };
  }

  const correctedPinName = trimToUndefined(review.correctedPinName);
  const correctedPinNumber = trimToUndefined(review.correctedPinNumber);
  const correctionNote = trimToUndefined(review.correctionNote);

  return correctedPinName && correctedPinNumber
    ? {
        correctionNote,
        correctedPinName,
        correctedPinNumber,
        pinIndex,
        status: "corrected",
      }
    : {
        pinIndex,
        status: "pending",
      };
}

export function createDefaultSubmissionReview(
  extraction: ExtractionSnapshot,
): SubmissionHumanReview {
  return {
    measurements: extraction.fields.map((field) => ({
      field: field.field,
      status: "pending" as const,
    })),
    packageSelection: {
      status: "pending",
    },
    pins: extraction.pinRows.map((_, pinIndex) => ({
      pinIndex,
      status: "pending" as const,
    })),
    reviewerNotes: "",
  };
}

export function normalizeSubmissionReview(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
): SubmissionHumanReview {
  const measurementReviewMap = new Map(
    review.measurements.map((entry) => [entry.field, entry]),
  );
  const pinReviewMap = new Map(review.pins.map((entry) => [entry.pinIndex, entry]));

  return {
    measurements: extraction.fields.map((field) =>
      normalizeMeasurementReview(field.field, measurementReviewMap.get(field.field)),
    ),
    packageSelection: normalizePackageSelectionReview(review.packageSelection),
    pins: extraction.pinRows.map((_, pinIndex) =>
      normalizePinReview(pinIndex, pinReviewMap.get(pinIndex)),
    ),
    reviewerNotes: review.reviewerNotes.trim(),
  };
}

export function hasStartedSubmissionReview(review: SubmissionHumanReview) {
  if (trimToUndefined(review.reviewerNotes)) {
    return true;
  }

  if (
    review.packageSelection.status !== "pending" ||
    trimToUndefined(review.packageSelection.correctedSelectedPackage) ||
    trimToUndefined(review.packageSelection.correctionNote)
  ) {
    return true;
  }

  if (
    review.measurements.some(
      (entry) =>
        entry.status !== "pending" ||
        entry.correctedStatus !== undefined ||
        trimToUndefined(entry.correctedValue) ||
        trimToUndefined(entry.correctionNote),
    )
  ) {
    return true;
  }

  return review.pins.some(
    (entry) =>
      entry.status !== "pending" ||
      trimToUndefined(entry.correctedPinName) ||
      trimToUndefined(entry.correctedPinNumber) ||
      trimToUndefined(entry.correctionNote),
  );
}

export function countReviewDecisions(
  review: SubmissionHumanReview,
): ReviewDecisionCounts {
  const decisions = [
    review.packageSelection.status,
    ...review.measurements.map((entry) => entry.status),
    ...review.pins.map((entry) => entry.status),
  ];

  return decisions.reduce<ReviewDecisionCounts>(
    (counts, status) => {
      counts[status] += 1;
      return counts;
    },
    {
      confirmed: 0,
      corrected: 0,
      pending: 0,
      total: decisions.length,
    },
  );
}

export function deriveSubmissionReviewStatus(
  review: SubmissionHumanReview,
): SubmissionReviewStatus {
  return countReviewDecisions(review).pending === 0 ? "reviewed" : "pending";
}

export function deriveSubmissionAccuracyPercentage(input: {
  reviewDecisionCounts: ReviewDecisionCounts;
  reviewStatus: SubmissionReviewStatus;
}): number | null {
  const {
    reviewDecisionCounts: { confirmed, total },
    reviewStatus,
  } = input;

  if (reviewStatus !== "reviewed" || total === 0) {
    return null;
  }

  return Math.round((confirmed / total) * 100);
}

/** Summarises decision counts for status badges, progress bars and lists. */
export function deriveReviewProgress(counts: ReviewDecisionCounts): ReviewProgress {
  const decided = counts.confirmed + counts.corrected;
  const state =
    counts.total > 0 && counts.pending === 0
      ? "reviewed"
      : decided === 0
        ? "notStarted"
        : "inProgress";

  return {
    accuracy: deriveSubmissionAccuracyPercentage({
      reviewDecisionCounts: counts,
      reviewStatus: counts.pending === 0 ? "reviewed" : "pending",
    }),
    confirmed: counts.confirmed,
    corrected: counts.corrected,
    decided,
    pending: counts.pending,
    state,
    total: counts.total,
  };
}

export function deriveSubmissionAccuracyBucket(input: {
  reviewDecisionCounts: ReviewDecisionCounts;
  reviewStatus: SubmissionReviewStatus;
}): SubmissionAccuracyBucket | null {
  const {
    reviewDecisionCounts: { confirmed, total },
    reviewStatus,
  } = input;

  if (reviewStatus !== "reviewed" || total === 0) {
    return null;
  }

  if (confirmed === total) {
    return "perfect";
  }

  return confirmed / total >= 0.8 ? "mostlyCorrect" : "belowThreshold";
}

export function buildSubmissionResolvedView(
  submission: Pick<SubmissionDetail, "extraction" | "review">,
): SubmissionResolvedView {
  const measurementReviewMap = new Map(
    submission.review.measurements.map((entry) => [entry.field, entry]),
  );
  const pinReviewMap = new Map(
    submission.review.pins.map((entry) => [entry.pinIndex, entry]),
  );
  const packageSelectionReview = submission.review.packageSelection;

  return {
    fields: submission.extraction.fields.map((field) => {
      const review = measurementReviewMap.get(field.field);

      if (review?.status !== "corrected") {
        return {
          ...field,
          isCorrected: false,
          originalStatus: field.status,
          originalValue: field.value,
          reviewStatus: review?.status ?? "pending",
        };
      }

      // Legacy corrections may lack correctedStatus; derive it on read with
      // the same rule applyCorrection uses for new corrections.
      const correctedStatus =
        review.correctedStatus ??
        (review.correctedValue !== undefined
          ? deriveCorrectedMeasurementStatus(field.status, review.correctedValue)
          : undefined);

      return {
        ...field,
        correctionNote: review.correctionNote,
        correctedStatus,
        correctedValue: review.correctedValue,
        isCorrected: true,
        originalStatus: field.status,
        originalValue: field.value,
        reviewStatus: "corrected",
        status: correctedStatus ?? field.status,
        value: review.correctedValue ?? field.value,
      };
    }),
    packageSelection:
      packageSelectionReview.status === "corrected"
        ? {
            ...submission.extraction.packageSelection,
            correctionNote: packageSelectionReview.correctionNote,
            correctedSelectedPackage:
              packageSelectionReview.correctedSelectedPackage,
            isCorrected: true,
            originalSelectedPackage:
              submission.extraction.packageSelection.selectedPackage,
            reviewStatus: "corrected",
            selectedPackage:
              packageSelectionReview.correctedSelectedPackage ??
              submission.extraction.packageSelection.selectedPackage,
          }
        : {
            ...submission.extraction.packageSelection,
            isCorrected: false,
            originalSelectedPackage:
              submission.extraction.packageSelection.selectedPackage,
            reviewStatus: packageSelectionReview.status,
          },
    pinRows: submission.extraction.pinRows.map((pinRow, pinIndex) => {
      const review = pinReviewMap.get(pinIndex);

      if (review?.status !== "corrected") {
        return {
          ...pinRow,
          isCorrected: false,
          originalPinName: pinRow.pinName,
          originalPinNumber: pinRow.pinNumber,
          pinIndex,
          reviewStatus: review?.status ?? "pending",
        };
      }

      return {
        ...pinRow,
        correctionNote: review.correctionNote,
        correctedPinName: review.correctedPinName,
        correctedPinNumber: review.correctedPinNumber,
        isCorrected: true,
        originalPinName: pinRow.pinName,
        originalPinNumber: pinRow.pinNumber,
        pinIndex,
        pinName: review.correctedPinName ?? pinRow.pinName,
        pinNumber: review.correctedPinNumber ?? pinRow.pinNumber,
        reviewStatus: "corrected",
      };
    }),
  };
}

/* ------------------------------------------------------------------------- */
/* Review workspace rules (Sept 2026 redesign). Everything below is pure and  */
/* works on the same full-overlay SubmissionHumanReview the PATCH route saves. */
/* ------------------------------------------------------------------------- */

/** Identifies one decision row in the review workspace. */
export type ReviewRowRef =
  | { kind: "package" }
  | { field: string; kind: "measurement" }
  | { kind: "pin"; pinIndex: number };

export type ReviewMode = "edit" | "read";

/** Row key of the package row, shared with agreement rows. */
export const PACKAGE_ROW_KEY = "package";

/** Row key of a measurement, shared with agreement rows. */
export function measurementRowKey(field: string) {
  return `measurement:${field.toLowerCase()}`;
}

/** Row key of a pin (by its index in the extraction), shared with agreement rows. */
export function pinRowKey(pinIndex: number) {
  return `pin:${pinIndex}`;
}

/** Stable key for a row ref. Matches `SubmissionAgreementRow.key` and `BaselineRunHints` keys. */
export function rowKeyOf(ref: ReviewRowRef): string {
  switch (ref.kind) {
    case "package":
      return PACKAGE_ROW_KEY;
    case "measurement":
      return measurementRowKey(ref.field);
    case "pin":
      return pinRowKey(ref.pinIndex);
  }
}

export function isSameRowRef(left: ReviewRowRef | null | undefined, right: ReviewRowRef | null | undefined) {
  if (!left || !right) {
    return false;
  }

  return rowKeyOf(left) === rowKeyOf(right);
}

/** Every row of an extraction in display order: package, measurements, pins. */
export function listReviewRowRefs(extraction: ExtractionSnapshot): ReviewRowRef[] {
  return [
    { kind: "package" },
    ...extraction.fields.map((field) => ({ field: field.field, kind: "measurement" as const })),
    ...extraction.pinRows.map((_, pinIndex) => ({ kind: "pin" as const, pinIndex })),
  ];
}

/**
 * Pending baselines open straight into edit mode. Reviewed baselines and every
 * re-run open in read mode.
 */
export function getInitialReviewMode(
  submission: Pick<SubmissionSummary, "comparison" | "reviewStatus">,
): ReviewMode {
  if (submission.comparison) {
    return "read";
  }

  return submission.reviewStatus === "pending" ? "edit" : "read";
}

type RowReviewEntry = MeasurementReview | PackageSelectionReview | PinReview;

/** The review overlay entry for a row, or undefined when the overlay has none. */
export function getRowReview(
  review: SubmissionHumanReview,
  ref: { kind: "package" },
): PackageSelectionReview;
export function getRowReview(
  review: SubmissionHumanReview,
  ref: { field: string; kind: "measurement" },
): MeasurementReview | undefined;
export function getRowReview(
  review: SubmissionHumanReview,
  ref: { kind: "pin"; pinIndex: number },
): PinReview | undefined;
export function getRowReview(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): RowReviewEntry | undefined;
export function getRowReview(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): RowReviewEntry | undefined {
  switch (ref.kind) {
    case "package":
      return review.packageSelection;
    case "measurement":
      return review.measurements.find((entry) => entry.field === ref.field);
    case "pin":
      return review.pins.find((entry) => entry.pinIndex === ref.pinIndex);
  }
}

export function getRowDecision(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): ReviewDecisionStatus {
  return getRowReview(review, ref)?.status ?? "pending";
}

function replaceRow(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
  entry: RowReviewEntry,
): SubmissionHumanReview {
  switch (ref.kind) {
    case "package":
      return { ...review, packageSelection: entry as PackageSelectionReview };
    case "measurement": {
      const index = review.measurements.findIndex((item) => item.field === ref.field);
      const measurements =
        index === -1
          ? [...review.measurements, entry as MeasurementReview]
          : review.measurements.map((item, itemIndex) =>
              itemIndex === index ? (entry as MeasurementReview) : item,
            );

      return { ...review, measurements };
    }
    case "pin": {
      const index = review.pins.findIndex((item) => item.pinIndex === ref.pinIndex);
      const pins =
        index === -1
          ? [...review.pins, entry as PinReview]
          : review.pins.map((item, itemIndex) =>
              itemIndex === index ? (entry as PinReview) : item,
            );

      return { ...review, pins };
    }
  }
}

function plainEntry(ref: ReviewRowRef, status: ReviewDecisionStatus): RowReviewEntry {
  switch (ref.kind) {
    case "package":
      return { status };
    case "measurement":
      return { field: ref.field, status };
    case "pin":
      return { pinIndex: ref.pinIndex, status };
  }
}

/**
 * Sets a row to confirmed or back to pending. Any stored correction on the row
 * is dropped, so confirming a corrected row replaces the correction. Use
 * `applyCorrection` for corrections.
 */
export function setDecision(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
  status: Exclude<ReviewDecisionStatus, "corrected">,
): SubmissionHumanReview {
  return replaceRow(review, ref, plainEntry(ref, status));
}

/** The Confirm segment: confirms the row, or returns an already confirmed row to pending. */
export function toggleConfirmed(
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): SubmissionHumanReview {
  return setDecision(
    review,
    ref,
    getRowDecision(review, ref) === "confirmed" ? "pending" : "confirmed",
  );
}

/* ----------------------------- Corrections -------------------------------- */

export type MeasurementCorrectionInput = {
  kind: "measurement";
  note: string;
  /** True when the reviewer chose "Not in datasheet"; `value` is then ignored. */
  notInDatasheet: boolean;
  value: string;
};

export type PinCorrectionInput = {
  kind: "pin";
  note: string;
  pinName: string;
  pinNumber: string;
};

export type PackageCorrectionInput = {
  kind: "package";
  note: string;
  selectedPackage: string;
};

export type CorrectionInput =
  | MeasurementCorrectionInput
  | PackageCorrectionInput
  | PinCorrectionInput;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findMeasurement(extraction: ExtractionSnapshot, field: string) {
  return extraction.fields.find((row) => row.field === field);
}

function isNotFoundValue(value: string | undefined) {
  return value !== undefined && value.trim() === NOT_FOUND_VALUE;
}

/**
 * The resolved status of a corrected measurement: "Not found" when the
 * correction is NOT_FOUND_VALUE, "Extracted" when the AI status was anything
 * other than "Extracted", otherwise undefined (the AI status stands).
 */
export function deriveCorrectedMeasurementStatus(
  aiStatus: MeasurementFieldStatus | undefined,
  correctedValue: string,
): MeasurementFieldStatus | undefined {
  if (isNotFoundValue(correctedValue)) {
    return "Not found";
  }

  return aiStatus === "Extracted" ? undefined : "Extracted";
}

/** Prefill for the correction editor: the existing correction, else the AI value. */
export function getCorrectionDefaults(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: { field: string; kind: "measurement" },
): MeasurementCorrectionInput;
export function getCorrectionDefaults(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: { kind: "pin"; pinIndex: number },
): PinCorrectionInput;
export function getCorrectionDefaults(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: { kind: "package" },
): PackageCorrectionInput;
export function getCorrectionDefaults(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): CorrectionInput;
export function getCorrectionDefaults(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
): CorrectionInput {
  switch (ref.kind) {
    case "measurement": {
      const entry = getRowReview(review, ref);

      if (entry?.status === "corrected" && entry.correctedValue) {
        const notInDatasheet = isNotFoundValue(entry.correctedValue);

        return {
          kind: "measurement",
          note: entry.correctionNote ?? "",
          notInDatasheet,
          value: entry.correctedValue,
        };
      }

      const field = findMeasurement(extraction, ref.field);
      const aiNotFound =
        !field || field.status === "Not found" || isNotFoundValue(field.value);

      return {
        kind: "measurement",
        note: "",
        notInDatasheet: false,
        value: aiNotFound ? "" : field.value,
      };
    }
    case "pin": {
      const entry = getRowReview(review, ref);
      const pin = extraction.pinRows[ref.pinIndex];

      if (entry?.status === "corrected") {
        return {
          kind: "pin",
          note: entry.correctionNote ?? "",
          pinName: entry.correctedPinName ?? pin?.pinName ?? "",
          pinNumber: entry.correctedPinNumber ?? pin?.pinNumber ?? "",
        };
      }

      return {
        kind: "pin",
        note: "",
        pinName: pin?.pinName ?? "",
        pinNumber: pin?.pinNumber ?? "",
      };
    }
    case "package": {
      const entry = review.packageSelection;

      if (entry.status === "corrected" && entry.correctedSelectedPackage) {
        return {
          kind: "package",
          note: entry.correctionNote ?? "",
          selectedPackage: entry.correctedSelectedPackage,
        };
      }

      return {
        kind: "package",
        note: "",
        selectedPackage: extraction.packageSelection.selectedPackage,
      };
    }
  }
}

/**
 * Inline validation for the correction editor. Returns the error message, or
 * null when the input can be applied. Mirrors normalizeSubmissionReview: a
 * correction without its required values would be demoted to pending.
 */
export function validateCorrection(
  ref: ReviewRowRef,
  input: CorrectionInput,
): string | null {
  if (ref.kind !== input.kind) {
    return "This correction doesn't match the selected row.";
  }

  switch (input.kind) {
    case "measurement":
      return input.notInDatasheet || input.value.trim().length > 0
        ? null
        : "Enter the correct value";
    case "pin":
      return input.pinNumber.trim().length > 0 && input.pinName.trim().length > 0
        ? null
        : "Enter the pin number and name";
    case "package":
      return input.selectedPackage.trim().length > 0 ? null : "Enter the correct package";
  }
}

/** True when the correction repeats the AI value (non-blocking "Same as the AI value." hint). */
export function isCorrectionUnchanged(
  extraction: ExtractionSnapshot,
  ref: ReviewRowRef,
  input: CorrectionInput,
): boolean {
  if (ref.kind !== input.kind) {
    return false;
  }

  switch (ref.kind) {
    case "measurement": {
      const measurementInput = input as MeasurementCorrectionInput;
      const field = findMeasurement(extraction, ref.field);

      if (!field) {
        return false;
      }

      const aiNotFound = field.status === "Not found" || isNotFoundValue(field.value);
      const correctionNotFound =
        measurementInput.notInDatasheet || isNotFoundValue(measurementInput.value);

      if (aiNotFound || correctionNotFound) {
        return aiNotFound && correctionNotFound;
      }

      return collapseWhitespace(field.value) === collapseWhitespace(measurementInput.value);
    }
    case "pin": {
      const pinInput = input as PinCorrectionInput;
      const pin = extraction.pinRows[ref.pinIndex];

      return (
        pin !== undefined &&
        collapseWhitespace(pin.pinNumber) === collapseWhitespace(pinInput.pinNumber) &&
        collapseWhitespace(pin.pinName) === collapseWhitespace(pinInput.pinName)
      );
    }
    case "package":
      return (
        collapseWhitespace(extraction.packageSelection.selectedPackage) ===
        collapseWhitespace((input as PackageCorrectionInput).selectedPackage)
      );
  }
}

function optionalNote(note: string) {
  const trimmed = note.trim();

  return trimmed.length > 0 ? { correctionNote: trimmed } : {};
}

/**
 * Applies a correction to the draft: status "corrected" plus the trimmed values.
 * Measurements get an explicit correctedStatus (see
 * deriveCorrectedMeasurementStatus). Invalid input returns the review unchanged.
 */
export function applyCorrection(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
  input: CorrectionInput,
): SubmissionHumanReview {
  if (validateCorrection(ref, input) !== null) {
    return review;
  }

  switch (ref.kind) {
    case "measurement": {
      const measurementInput = input as MeasurementCorrectionInput;
      const correctedValue =
        measurementInput.notInDatasheet || isNotFoundValue(measurementInput.value)
          ? NOT_FOUND_VALUE
          : measurementInput.value.trim();
      const correctedStatus = deriveCorrectedMeasurementStatus(
        findMeasurement(extraction, ref.field)?.status,
        correctedValue,
      );

      return replaceRow(review, ref, {
        ...optionalNote(measurementInput.note),
        ...(correctedStatus ? { correctedStatus } : {}),
        correctedValue,
        field: ref.field,
        status: "corrected",
      });
    }
    case "pin": {
      const pinInput = input as PinCorrectionInput;

      return replaceRow(review, ref, {
        ...optionalNote(pinInput.note),
        correctedPinName: pinInput.pinName.trim(),
        correctedPinNumber: pinInput.pinNumber.trim(),
        pinIndex: ref.pinIndex,
        status: "corrected",
      });
    }
    case "package": {
      const packageInput = input as PackageCorrectionInput;

      return replaceRow(review, ref, {
        ...optionalNote(packageInput.note),
        correctedSelectedPackage: packageInput.selectedPackage.trim(),
        status: "corrected",
      });
    }
  }
}

/* ------------------------------- Attention -------------------------------- */

export type AttentionReason =
  | "differsFromBaseline"
  | "lowConfidence"
  | "aiUnsure"
  | "notFound"
  | "mediumConfidence"
  | "duplicatePinNumber"
  | "runsDisagree"
  | "needsReview"
  | "noEvidence";

/** Reasons in display order; the first one is shown on the row. */
export const ATTENTION_REASONS: readonly AttentionReason[] = [
  "differsFromBaseline",
  "lowConfidence",
  "aiUnsure",
  "notFound",
  "mediumConfidence",
  "duplicatePinNumber",
  "runsDisagree",
  "needsReview",
  "noEvidence",
];

const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  aiUnsure: "AI unsure",
  differsFromBaseline: "Differs from baseline",
  duplicatePinNumber: "Pin number appears more than once",
  lowConfidence: "Low confidence",
  mediumConfidence: "Medium confidence",
  needsReview: "Extraction flagged by the AI",
  noEvidence: "No evidence page",
  notFound: "Not found by the AI",
  runsDisagree: "Other model runs differ",
};

export function describeAttentionReason(reason: AttentionReason): string {
  return ATTENTION_REASON_LABELS[reason];
}

/**
 * Optional context for attention and bulk rules.
 * - agreementOutcome: this row's outcome on a re-run page (from agreement rows by key).
 * - runHints: the baseline's hints from buildBaselineRunHints (looked up by row key).
 */
export type AttentionContext = {
  agreementOutcome?: AgreementOutcome | null;
  runHints?: BaselineRunHints | null;
};

function toAttentionContext(
  context: AgreementOutcome | AttentionContext | null | undefined,
): AttentionContext {
  if (!context) {
    return {};
  }

  return typeof context === "string" ? { agreementOutcome: context } : context;
}

function hasEvidencePages(pages: number[] | undefined) {
  return Array.isArray(pages) && pages.length > 0;
}

/**
 * Legacy extractions predate evidence pages entirely. Only flag missing
 * evidence when the extraction records evidence pages somewhere.
 */
function extractionRecordsEvidence(extraction: ExtractionSnapshot) {
  return (
    extraction.fields.some((field) => field.evidencePages !== undefined) ||
    extraction.pinRows.some((pin) => pin.evidencePages !== undefined)
  );
}

function normalizePinNumber(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sortReasons(reasons: Set<AttentionReason>): AttentionReason[] {
  return ATTENTION_REASONS.filter((reason) => reasons.has(reason));
}

/**
 * Whether a baseline row's run hint is strong enough to flag "runsDisagree":
 * at least half of the loaded runs MISMATCH on the row (mismatches * 2 >=
 * runs). Partial matches never count, so one weak run or a few partial
 * matches do not flag every row.
 */
export function runHintDisagrees(hint: BaselineRunHint | null | undefined): boolean {
  if (!hint || hint.runs < 1 || hint.differs < 1) {
    return false;
  }

  return hint.differs * 2 >= hint.runs;
}

/**
 * Why a row needs a closer look. An empty list means the row is calm.
 * The third argument is either the row's agreement outcome (re-runs) or an
 * AttentionContext that can also carry the baseline's run hints.
 */
export function classifyRowAttention(
  extraction: ExtractionSnapshot,
  ref: ReviewRowRef,
  context?: AgreementOutcome | AttentionContext | null,
): AttentionReason[] {
  const { agreementOutcome, runHints } = toAttentionContext(context);
  const reasons = new Set<AttentionReason>();

  if (agreementOutcome && agreementOutcome !== "match") {
    reasons.add("differsFromBaseline");
  }

  if (runHintDisagrees(runHints?.[rowKeyOf(ref)])) {
    reasons.add("runsDisagree");
  }

  const addConfidence = (confidence: string | undefined) => {
    if (confidence === "low") {
      reasons.add("lowConfidence");
    } else if (confidence === "medium") {
      reasons.add("mediumConfidence");
    }
  };

  switch (ref.kind) {
    case "package": {
      addConfidence(extraction.packageSelection.confidence);

      if (extraction.review.needsReview) {
        reasons.add("needsReview");
      }

      break;
    }
    case "measurement": {
      const field = findMeasurement(extraction, ref.field);

      if (!field) {
        break;
      }

      addConfidence(field.confidence);

      if (field.status === "Needs review") {
        reasons.add("aiUnsure");
      } else if (field.status === "Not found") {
        reasons.add("notFound");
      }

      if (
        field.status !== "Not found" &&
        !hasEvidencePages(field.evidencePages) &&
        extractionRecordsEvidence(extraction)
      ) {
        reasons.add("noEvidence");
      }

      break;
    }
    case "pin": {
      const pin = extraction.pinRows[ref.pinIndex];

      if (!pin) {
        break;
      }

      addConfidence(pin.confidence);

      const pinNumber = normalizePinNumber(pin.pinNumber);

      if (
        pinNumber.length > 0 &&
        extraction.pinRows.some(
          (other, index) =>
            index !== ref.pinIndex && normalizePinNumber(other.pinNumber) === pinNumber,
        )
      ) {
        reasons.add("duplicatePinNumber");
      }

      if (!hasEvidencePages(pin.evidencePages) && extractionRecordsEvidence(extraction)) {
        reasons.add("noEvidence");
      }

      break;
    }
  }

  return sortReasons(reasons);
}

/* ------------------------------ Bulk confirm ------------------------------ */

function rowConfidence(extraction: ExtractionSnapshot, ref: ReviewRowRef) {
  switch (ref.kind) {
    case "package":
      return extraction.packageSelection.confidence;
    case "measurement":
      return findMeasurement(extraction, ref.field)?.confidence;
    case "pin":
      return extraction.pinRows[ref.pinIndex]?.confidence;
  }
}

function rowExists(extraction: ExtractionSnapshot, ref: ReviewRowRef) {
  switch (ref.kind) {
    case "package":
      return true;
    case "measurement":
      return findMeasurement(extraction, ref.field) !== undefined;
    case "pin":
      return ref.pinIndex >= 0 && ref.pinIndex < extraction.pinRows.length;
  }
}

/**
 * A row can be bulk-confirmed when it is pending, needs no attention and the
 * AI reported high confidence (a missing confidence is not eligible).
 * Measurements must also have AI status "Extracted".
 */
export function isBulkConfirmEligible(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
  context?: AgreementOutcome | AttentionContext | null,
): boolean {
  if (!rowExists(extraction, ref) || getRowDecision(review, ref) !== "pending") {
    return false;
  }

  if (rowConfidence(extraction, ref) !== "high") {
    return false;
  }

  if (
    ref.kind === "measurement" &&
    findMeasurement(extraction, ref.field)?.status !== "Extracted"
  ) {
    return false;
  }

  return classifyRowAttention(extraction, ref, context).length === 0;
}

export type BulkConfirmPlan = {
  /** Visible pending rows that can be confirmed in bulk ("Confirm N high-confidence"). */
  eligible: ReviewRowRef[];
  /** Visible pending rows skipped because they need attention ("Skips M rows that need attention"). */
  skippedForAttention: number;
};

/**
 * Plans a bulk confirm over the rows visible under the current filter and
 * search. `contextFor` supplies each row's agreement outcome and run hints.
 */
export function planBulkConfirm(
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  visibleRefs: readonly ReviewRowRef[],
  contextFor?: (ref: ReviewRowRef) => AgreementOutcome | AttentionContext | null | undefined,
): BulkConfirmPlan {
  const eligible: ReviewRowRef[] = [];
  let skippedForAttention = 0;

  for (const ref of visibleRefs) {
    if (!rowExists(extraction, ref) || getRowDecision(review, ref) !== "pending") {
      continue;
    }

    const context = contextFor?.(ref);

    if (isBulkConfirmEligible(extraction, review, ref, context)) {
      eligible.push(ref);
    } else if (classifyRowAttention(extraction, ref, context).length > 0) {
      skippedForAttention += 1;
    }
  }

  return { eligible, skippedForAttention };
}

/**
 * Confirms every PENDING row in `refs`. Confirmed and corrected rows are never
 * overwritten. Eligibility is the caller's job (see planBulkConfirm).
 */
export function bulkConfirm(
  review: SubmissionHumanReview,
  refs: readonly ReviewRowRef[],
): { changed: number; review: SubmissionHumanReview } {
  let next = review;
  let changed = 0;
  const seen = new Set<string>();

  for (const ref of refs) {
    const key = rowKeyOf(ref);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    if (getRowDecision(next, ref) === "pending") {
      next = setDecision(next, ref, "confirmed");
      changed += 1;
    }
  }

  return { changed, review: next };
}

/* ------------------------------- Counting --------------------------------- */

function emptyCounts(): ReviewDecisionCounts {
  return { confirmed: 0, corrected: 0, pending: 0, total: 0 };
}

function addStatus(counts: ReviewDecisionCounts, status: ReviewDecisionStatus) {
  counts[status] += 1;
  counts.total += 1;
}

export type SectionDecisionCounts = {
  measurements: ReviewDecisionCounts;
  package: ReviewDecisionCounts;
  pins: ReviewDecisionCounts;
};

/** Decision counts per review section, for section links and headers. */
export function countSectionDecisions(review: SubmissionHumanReview): SectionDecisionCounts {
  const counts: SectionDecisionCounts = {
    measurements: emptyCounts(),
    package: emptyCounts(),
    pins: emptyCounts(),
  };

  addStatus(counts.package, review.packageSelection.status);
  review.measurements.forEach((entry) => addStatus(counts.measurements, entry.status));
  review.pins.forEach((entry) => addStatus(counts.pins, entry.status));

  return counts;
}

/** Decision counts over a subset of rows, e.g. one pin group. */
export function countDecisionsForRows(
  review: SubmissionHumanReview,
  refs: readonly ReviewRowRef[],
): ReviewDecisionCounts {
  const counts = emptyCounts();

  refs.forEach((ref) => addStatus(counts, getRowDecision(review, ref)));

  return counts;
}

function sameEntry(left: RowReviewEntry, right: RowReviewEntry) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    if (
      (left as Record<string, unknown>)[key] !== (right as Record<string, unknown>)[key]
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Number of rows whose normalized entry differs in ANY field (status,
 * corrected values, correctedStatus or note). Reviewer notes are not rows;
 * see isReviewDraftDirty.
 */
export function countChangedDecisions(
  saved: SubmissionHumanReview,
  draft: SubmissionHumanReview,
): number {
  let changed = sameEntry(
    normalizePackageSelectionReview(saved.packageSelection),
    normalizePackageSelectionReview(draft.packageSelection),
  )
    ? 0
    : 1;

  const savedMeasurements = new Map(saved.measurements.map((entry) => [entry.field, entry]));
  const draftMeasurements = new Map(draft.measurements.map((entry) => [entry.field, entry]));

  for (const field of new Set([...savedMeasurements.keys(), ...draftMeasurements.keys()])) {
    if (
      !sameEntry(
        normalizeMeasurementReview(field, savedMeasurements.get(field)),
        normalizeMeasurementReview(field, draftMeasurements.get(field)),
      )
    ) {
      changed += 1;
    }
  }

  const savedPins = new Map(saved.pins.map((entry) => [entry.pinIndex, entry]));
  const draftPins = new Map(draft.pins.map((entry) => [entry.pinIndex, entry]));

  for (const pinIndex of new Set([...savedPins.keys(), ...draftPins.keys()])) {
    if (
      !sameEntry(
        normalizePinReview(pinIndex, savedPins.get(pinIndex)),
        normalizePinReview(pinIndex, draftPins.get(pinIndex)),
      )
    ) {
      changed += 1;
    }
  }

  return changed;
}

/** Longest reviewer note the review API accepts (submissionReviewPayloadSchema). */
export const REVIEWER_NOTES_MAX_LENGTH = 4000;

export function hasReviewerNotesChanged(
  saved: SubmissionHumanReview,
  draft: SubmissionHumanReview,
) {
  return saved.reviewerNotes.trim() !== draft.reviewerNotes.trim();
}

/** Dirty = at least one changed row, or changed reviewer notes. */
export function isReviewDraftDirty(saved: SubmissionHumanReview, draft: SubmissionHumanReview) {
  return countChangedDecisions(saved, draft) > 0 || hasReviewerNotesChanged(saved, draft);
}

/* ------------------------------- Navigation -------------------------------- */

/**
 * The next pending row in `order` (the filtered display order) after `from`,
 * wrapping around. The `from` row itself is never returned. Returns null when
 * no other row is pending. With no `from`, the search starts at the first row
 * (or the last, for direction -1).
 */
export function findNextPendingRow(
  review: SubmissionHumanReview,
  order: readonly ReviewRowRef[],
  from?: ReviewRowRef | null,
  options: { direction?: 1 | -1; wrap?: boolean } = {},
): ReviewRowRef | null {
  const direction = options.direction ?? 1;
  const wrap = options.wrap ?? true;
  const count = order.length;

  if (count === 0) {
    return null;
  }

  const fromKey = from ? rowKeyOf(from) : null;
  const fromIndex = fromKey ? order.findIndex((ref) => rowKeyOf(ref) === fromKey) : -1;
  const start =
    fromIndex === -1 ? (direction === 1 ? 0 : count - 1) : fromIndex + direction;

  for (let step = 0; step < count; step += 1) {
    let index = start + step * direction;

    if (index < 0 || index >= count) {
      if (!wrap) {
        return null;
      }

      index = ((index % count) + count) % count;
    }

    if (index === fromIndex) {
      continue;
    }

    const ref = order[index];

    if (getRowDecision(review, ref) === "pending") {
      return ref;
    }
  }

  return null;
}
