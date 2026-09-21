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
  bucketName?: string;
  checksumSha256: string;
  fileName: string;
  kind: "upload";
  mimeType: string;
  objectKey?: string;
  sizeBytes: number;
  storageProvider?: "cloudflare-r2";
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
  comparison?: SubmissionComparison;
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

export type AgreementOutcome = "match" | "mismatch" | "partial";

export type AgreementBasis = "reviewed" | "unreviewed";

export type SubmissionAgreementRow = {
  baselineValue: string;
  kind: "measurement" | "package" | "pin";
  label: string;
  outcome: AgreementOutcome;
  rerunValue: string;
};

export type SubmissionAgreement = {
  agreementPercentage: number | null;
  basis: AgreementBasis;
  baselineReviewStatus: SubmissionReviewStatus;
  baselineReviewedDecisions: number;
  baselineTotalDecisions: number;
  compared: number;
  matches: number;
  mismatches: number;
  partialMatches: number;
  rows: SubmissionAgreementRow[];
};

/** Stored on a re-run submission to link it to the submission it was cloned from. */
export type SubmissionRerunLink = {
  baselineSubmissionId: string;
};

export type SubmissionBaselineRef = {
  model: string;
  partNumber: string;
  reviewStatus: SubmissionReviewStatus;
  submissionId: string;
};

export type SubmissionComparison = {
  agreement: SubmissionAgreement | null;
  baseline: SubmissionBaselineRef | null;
  baselineSubmissionId: string;
};

export type SubmissionModelRun = {
  agreement: SubmissionAgreement | null;
  createdAt: string;
  isBaseline: boolean;
  providerMeta: ProviderMeta;
  reviewStatus: SubmissionReviewStatus;
  submissionId: string;
};
