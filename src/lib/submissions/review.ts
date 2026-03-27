import type {
  ExtractionSnapshot,
  MeasurementReview,
  PackageSelectionReview,
  PinReview,
  ReviewDecisionCounts,
  SubmissionAccuracyBucket,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionResolvedView,
  SubmissionReviewStatus,
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

      return {
        ...field,
        correctionNote: review.correctionNote,
        correctedStatus: review.correctedStatus,
        correctedValue: review.correctedValue,
        isCorrected: true,
        originalStatus: field.status,
        originalValue: field.value,
        reviewStatus: "corrected",
        status: review.correctedStatus ?? field.status,
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
