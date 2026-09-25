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
  /** sha256 hex of the PDF bytes that were extracted. Set for URL submissions created after the Sept 2026 redesign. */
  contentSha256?: string;
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
  /** Index of the row in the baseline extraction (measurement field index or pin index). Absent for the package row. */
  baselineIndex?: number;
  baselineValue: string;
  /**
   * Stable row key shared with the review workspace:
   * "package", "measurement:<field lower-case>", or "pin:<baseline pin index>".
   */
  key: string;
  kind: "measurement" | "package" | "pin";
  label: string;
  outcome: AgreementOutcome;
  /** Index of the matched row in the re-run extraction, when one was found. */
  rerunIndex?: number;
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
  reviewProgress: ReviewProgress;
  reviewStatus: SubmissionReviewStatus;
  submissionId: string;
};

/* ------------------------------------------------------------------------- */
/* Redesign contracts (Sept 2026). Shared by the list, review, reports and    */
/* intake packages. Change only with the lead engineer.                       */
/* ------------------------------------------------------------------------- */

export type ReviewProgressState = "notStarted" | "inProgress" | "reviewed";

export type ReviewProgress = {
  /** Accuracy percentage once fully reviewed, otherwise null. */
  accuracy: number | null;
  confirmed: number;
  corrected: number;
  decided: number;
  pending: number;
  state: ReviewProgressState;
  total: number;
};

export type SubmissionSourceSummary = {
  /** Display file name, e.g. "se555.pdf". */
  fileName: string;
  /** URL host without "www.", e.g. "ti.com"; null for uploads. */
  host: string | null;
  kind: "upload" | "url";
  /** Short label for meta lines, e.g. "ti.com · se555.pdf" or "se555.pdf". */
  label: string;
  originalUrl: string | null;
  sizeBytes: number | null;
};

export type SubmissionListRun = {
  agreementBasis: AgreementBasis | null;
  agreementPercentage: number | null;
  baselineReviewStatus: SubmissionReviewStatus | null;
  baselineReviewedDecisions: number | null;
  baselineTotalDecisions: number | null;
  createdAt: string;
  /** True when isScoredAgreement(agreement) holds. */
  isScored: boolean;
  providerMeta: ProviderMeta;
  reviewProgress: ReviewProgress;
  submissionId: string;
};

export type DatasheetGroupBaseline = {
  createdAt: string;
  packageCategory: PackageCategory;
  partNumber: string;
  pdfAvailable: boolean;
  /** Internal PDF route from `getSubmissionPdfHref`, or null when no copy is available. */
  pdfHref: string | null;
  providerMeta: ProviderMeta;
  reviewProgress: ReviewProgress;
  reviewedAt: string | null;
  source: SubmissionSourceSummary;
  submissionId: string;
  updatedAt: string;
};

/** One row group on /submissions: a baseline and the re-runs compared against it. */
export type DatasheetGroup = {
  baseline: DatasheetGroupBaseline;
  /** Other baselines with the same normalized part number. */
  duplicateCount: number;
  /** A re-run whose baseline was deleted, shown as its own group. */
  isOrphanRun: boolean;
  /** Latest of the baseline's updatedAt and its runs' createdAt. */
  lastActivityAt: string;
  runs: SubmissionListRun[];
  /** Min and max agreement over SCORED runs only, or null. */
  scoredAgreementRange: { max: number; min: number } | null;
};

export type DatasheetListStatus = "all" | "needs-review" | "reviewed";

export type DatasheetListSort = "recent" | "newest" | "part" | "pending";

export type DatasheetListQuery = {
  category: PackageCategory | null;
  limit: number;
  q: string;
  sort: DatasheetListSort;
  status: DatasheetListStatus;
};

export type DatasheetListResult = {
  /** Counts reflect q and category but not status. Re-runs are never counted. */
  counts: { all: number; needsReview: number; reviewed: number };
  /** Totals over every baseline, ignoring q, category and status. Re-runs are never counted. */
  totals: { all: number; needsReview: number };
  groups: DatasheetGroup[];
  hasMore: boolean;
  /** Categories present among baselines, for the category filter. */
  categories: PackageCategory[];
};

export type DatasheetIndexEntry = {
  createdAt: string;
  normalizedPartNumber: string;
  normalizedUrl: string | null;
  packageCategory: PackageCategory;
  partNumber: string;
  pdfRetained: boolean;
  reviewProgress: ReviewProgress;
  runCount: number;
  submissionId: string;
};

export type NextReviewTarget = {
  partNumber: string;
  submissionId: string;
};

export type ReportSubmission = SubmissionSummary & {
  isBaseline: boolean;
  measurementDecisions: Array<{ field: string; status: ReviewDecisionStatus }>;
  packageDecision: ReviewDecisionStatus;
  pinDecisionCounts: ReviewDecisionCounts;
  /** The baseline id for re-runs, the submission's own id for baselines. */
  rootSubmissionId: string;
};

/** Lean run metadata for intake time/cost estimates. */
export type RunMetaSummary = Pick<
  SubmissionSummary,
  "comparison" | "providerMeta" | "reviewDecisionCounts" | "reviewStatus"
>;

export type PdfViewerState =
  | {
      expiresAt: string;
      fileName: string;
      /** "extracted" = the exact bytes that were extracted; "latest-copy" = a copy fetched later from the vendor. */
      revision: "extracted" | "latest-copy";
      cachedAt: string | null;
      sizeBytes: number | null;
      source: "upload" | "url-cache";
      status: "ready";
      url: string;
    }
  | { fileName: string; originalUrl: string; status: "uncached" }
  | { reason: "not-retained"; status: "unavailable" };

/** Per baseline row key: how the loaded re-runs compare on that row. */
export type BaselineRunHint = {
  differs: number;
  partial: number;
  runs: number;
};

export type BaselineRunHints = Record<string, BaselineRunHint>;
