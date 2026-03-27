import type {
  MeasurementFieldRow,
  MeasurementFieldStatus,
  PackageCategory,
  PackageSelection,
  PinRow,
  ProviderMeta,
  ReviewSummary,
  SourceMode,
} from "@/lib/package-categories";

export type UploadSourceMeta = {
  checksumSha256: string;
  fileName: string;
  kind: "upload";
  mimeType: string;
  sizeBytes: number;
};

export type UrlSourceMeta = {
  kind: "url";
  normalizedUrl: string;
  pdfFileName: string;
};

export type SubmissionSourceMeta = UploadSourceMeta | UrlSourceMeta;

export type SubmissionIntakeSnapshot = {
  packageCategory: PackageCategory;
  partNumber: string;
  requestedFields: string[];
  sourceLabel: string;
  sourceMeta: SubmissionSourceMeta;
  sourceMode: SourceMode;
};

export type ExtractionSnapshot = {
  fields: MeasurementFieldRow[];
  packageSelection: PackageSelection;
  pinRows: PinRow[];
  providerMeta: ProviderMeta;
  review: ReviewSummary;
};

export type ReviewDecisionStatus = "pending" | "confirmed" | "corrected";

export type SubmissionReviewStatus = "pending" | "reviewed";

export type PackageSelectionReview = {
  correctionNote?: string;
  correctedSelectedPackage?: string;
  status: ReviewDecisionStatus;
};

export type MeasurementReview = {
  correctionNote?: string;
  correctedStatus?: MeasurementFieldStatus;
  correctedValue?: string;
  field: string;
  status: ReviewDecisionStatus;
};

export type PinReview = {
  correctionNote?: string;
  correctedPinName?: string;
  correctedPinNumber?: string;
  pinIndex: number;
  status: ReviewDecisionStatus;
};

export type SubmissionHumanReview = {
  measurements: MeasurementReview[];
  packageSelection: PackageSelectionReview;
  pins: PinReview[];
  reviewerNotes: string;
};

export type SubmissionReviewPayload = SubmissionHumanReview;

export type ReviewDecisionCounts = {
  confirmed: number;
  corrected: number;
  pending: number;
  total: number;
};

export type SubmissionAccuracyBucket =
  | "perfect"
  | "mostlyCorrect"
  | "belowThreshold";

export type SubmissionSummary = {
  createdAt: string;
  intake: SubmissionIntakeSnapshot;
  providerMeta: ProviderMeta;
  reviewDecisionCounts: ReviewDecisionCounts;
  reviewStatus: SubmissionReviewStatus;
  reviewedAt: string | null;
  submissionId: string;
  updatedAt: string;
};

export type SubmissionDetail = SubmissionSummary & {
  extraction: ExtractionSnapshot;
  review: SubmissionHumanReview;
};

export type ResolvedPackageSelection = PackageSelection & {
  correctionNote?: string;
  correctedSelectedPackage?: string;
  isCorrected: boolean;
  originalSelectedPackage: string;
  reviewStatus: ReviewDecisionStatus;
};

export type ResolvedMeasurementRow = MeasurementFieldRow & {
  correctionNote?: string;
  correctedStatus?: MeasurementFieldStatus;
  correctedValue?: string;
  isCorrected: boolean;
  originalStatus: MeasurementFieldStatus;
  originalValue: string;
  reviewStatus: ReviewDecisionStatus;
};

export type ResolvedPinRow = PinRow & {
  correctionNote?: string;
  correctedPinName?: string;
  correctedPinNumber?: string;
  isCorrected: boolean;
  originalPinName: string;
  originalPinNumber: string;
  pinIndex: number;
  reviewStatus: ReviewDecisionStatus;
};

export type SubmissionResolvedView = {
  fields: ResolvedMeasurementRow[];
  packageSelection: ResolvedPackageSelection;
  pinRows: ResolvedPinRow[];
};
