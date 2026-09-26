import {
  type Collection,
  ObjectId,
  type WithId,
} from "mongodb";

import { getMongoDatabase } from "@/lib/mongodb";
import {
  packageCategories,
  type PackageCategory,
  type ProviderMeta,
} from "@/lib/package-categories";
import {
  computeSubmissionAgreement,
  isScoredAgreement,
} from "@/lib/submissions/agreement";
import {
  countReviewDecisions,
  deriveReviewProgress,
  createDefaultSubmissionReview,
  deriveSubmissionReviewStatus,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import {
  describeSubmissionSource,
  getSubmissionPdfHref,
  hasRetainedUploadSource,
  normalizePartNumberKey,
} from "@/lib/submissions/source";
import type {
  DatasheetGroup,
  DatasheetGroupBaseline,
  DatasheetIndexEntry,
  DatasheetListQuery,
  DatasheetListResult,
  ExtractionSnapshot,
  NextReviewTarget,
  ReportSubmission,
  ReviewDecisionCounts,
  ReviewProgress,
  RunMetaSummary,
  SubmissionAgreement,
  SubmissionBaselineRef,
  SubmissionComparison,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionIntakeSnapshot,
  SubmissionListRun,
  SubmissionModelRun,
  SubmissionRerunLink,
  SubmissionReviewPayload,
  SubmissionReviewStatus,
  SubmissionSummary,
} from "@/lib/submissions/types";

const COLLECTION_NAME = "datasheet_submissions";

type SubmissionDocument = {
  comparison?: SubmissionRerunLink;
  createdAt: Date;
  extraction: ExtractionSnapshot;
  intake: SubmissionIntakeSnapshot;
  review: SubmissionHumanReview;
  reviewedAt: Date | null;
  reviewStatus: SubmissionReviewStatus;
  updatedAt: Date;
};

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

async function getSubmissionCollection(): Promise<Collection<SubmissionDocument>> {
  const database = await getMongoDatabase();

  return database.collection<SubmissionDocument>(COLLECTION_NAME);
}

function buildBaselineRef(
  baseline: WithId<SubmissionDocument>,
): SubmissionBaselineRef {
  return {
    model: baseline.extraction.providerMeta.model,
    partNumber: baseline.intake.partNumber,
    reviewStatus: deriveSubmissionReviewStatus(baseline.review),
    submissionId: baseline._id.toHexString(),
  };
}

function buildComparison(
  document: SubmissionDocument,
  baseline: WithId<SubmissionDocument> | null | undefined,
): SubmissionComparison | undefined {
  if (!document.comparison) {
    return undefined;
  }

  return {
    agreement: baseline
      ? computeSubmissionAgreement(baseline, document.extraction)
      : null,
    baseline: baseline ? buildBaselineRef(baseline) : null,
    baselineSubmissionId: document.comparison.baselineSubmissionId,
  };
}

function mapSubmissionDocument(
  document: WithId<SubmissionDocument>,
  baseline?: WithId<SubmissionDocument> | null,
): SubmissionDetail {
  const reviewStatus = deriveSubmissionReviewStatus(document.review);
  const comparison = buildComparison(document, baseline);

  return {
    ...(comparison ? { comparison } : {}),
    createdAt: document.createdAt.toISOString(),
    extraction: document.extraction,
    intake: document.intake,
    providerMeta: document.extraction.providerMeta,
    review: document.review,
    reviewDecisionCounts: countReviewDecisions(document.review),
    reviewStatus,
    reviewedAt: reviewStatus === "reviewed" ? toIsoString(document.reviewedAt) : null,
    submissionId: document._id.toHexString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function mapSubmissionSummary(
  document: WithId<SubmissionDocument>,
  baseline?: WithId<SubmissionDocument> | null,
): SubmissionSummary {
  const detail = mapSubmissionDocument(document, baseline);

  return {
    ...(detail.comparison ? { comparison: detail.comparison } : {}),
    createdAt: detail.createdAt,
    intake: detail.intake,
    providerMeta: detail.providerMeta,
    reviewDecisionCounts: detail.reviewDecisionCounts,
    reviewStatus: detail.reviewStatus,
    reviewedAt: detail.reviewedAt,
    submissionId: detail.submissionId,
    updatedAt: detail.updatedAt,
  };
}

const SUBMISSION_ID_PATTERN = /^[0-9a-f]{24}$/i;

/**
 * True for a 24-character hex ObjectId string. Stricter than
 * `ObjectId.isValid`, which also accepts any 12-character string.
 */
export function isValidSubmissionId(submissionId: unknown): submissionId is string {
  return typeof submissionId === "string" && SUBMISSION_ID_PATTERN.test(submissionId);
}

function toObjectId(submissionId: string): ObjectId | null {
  if (!isValidSubmissionId(submissionId)) {
    return null;
  }

  return new ObjectId(submissionId);
}

export async function createSubmission(input: {
  comparison?: SubmissionRerunLink;
  extraction: ExtractionSnapshot;
  intake: SubmissionIntakeSnapshot;
  submissionId?: string;
}): Promise<SubmissionDetail> {
  const collection = await getSubmissionCollection();
  const now = new Date();
  const review = createDefaultSubmissionReview(input.extraction);
  const reviewStatus = deriveSubmissionReviewStatus(review);
  const objectId = input.submissionId
    ? toObjectId(input.submissionId)
    : new ObjectId();

  if (!objectId) {
    throw new Error("Invalid submission id.");
  }

  const document: SubmissionDocument = {
    ...(input.comparison ? { comparison: input.comparison } : {}),
    createdAt: now,
    extraction: input.extraction,
    intake: input.intake,
    review,
    reviewedAt: reviewStatus === "reviewed" ? now : null,
    reviewStatus,
    updatedAt: now,
  };

  await collection.insertOne({
    ...document,
    _id: objectId,
  });

  const baseline = input.comparison ? await findBaselineDocument(document) : null;

  return mapSubmissionDocument(
    {
      ...document,
      _id: objectId,
    },
    baseline,
  );
}

export async function listSubmissionSummaries() {
  const collection = await getSubmissionCollection();
  const documents = await collection
    .find({})
    .sort({
      createdAt: -1,
    })
    .toArray();

  const documentsById = new Map(
    documents.map((document) => [document._id.toHexString(), document] as const),
  );

  return documents.map((document) =>
    mapSubmissionSummary(
      document,
      document.comparison
        ? (documentsById.get(document.comparison.baselineSubmissionId) ?? null)
        : null,
    ),
  );
}

/**
 * Lean existence check: a covered lookup on the _id index. The review route's
 * layout calls it before anything streams, so an unknown id can still answer
 * with an HTTP 404 (see src/app/submissions/[submissionId]/layout.tsx).
 */
export async function submissionExists(submissionId: string): Promise<boolean> {
  const objectId = toObjectId(submissionId);

  if (!objectId) {
    return false;
  }

  const collection = await getSubmissionCollection();
  const document = await collection.findOne(
    { _id: objectId },
    { projection: { _id: 1 } },
  );

  return document !== null;
}

export async function getSubmissionDetail(
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const objectId = toObjectId(submissionId);

  if (!objectId) {
    return null;
  }

  const collection = await getSubmissionCollection();
  const document = await collection.findOne({
    _id: objectId,
  });

  if (!document) {
    return null;
  }

  return mapSubmissionDocument(document, await findBaselineDocument(document));
}

export async function updateSubmissionReview(
  submissionId: string,
  payload: SubmissionReviewPayload,
): Promise<SubmissionDetail | null> {
  const objectId = toObjectId(submissionId);

  if (!objectId) {
    return null;
  }

  const collection = await getSubmissionCollection();
  const existingDocument = await collection.findOne({
    _id: objectId,
  });

  if (!existingDocument) {
    return null;
  }

  const review = normalizeSubmissionReview(existingDocument.extraction, payload);
  const previousReviewStatus = deriveSubmissionReviewStatus(existingDocument.review);
  const updatedAt = new Date();
  const reviewStatus = deriveSubmissionReviewStatus(review);
  const reviewedAt =
    reviewStatus === "reviewed"
      ? previousReviewStatus === "reviewed" && existingDocument.reviewedAt
        ? existingDocument.reviewedAt
        : updatedAt
      : null;

  await collection.updateOne(
    {
      _id: objectId,
    },
    {
      $set: {
        review,
        reviewedAt,
        reviewStatus,
        updatedAt,
      },
    },
  );

  return mapSubmissionDocument(
    {
    ...existingDocument,
    _id: objectId,
    review,
    reviewedAt,
    reviewStatus,
    updatedAt,
    },
    await findBaselineDocument(existingDocument),
  );
}

export async function deleteSubmission(submissionId: string): Promise<boolean> {
  const objectId = toObjectId(submissionId);

  if (!objectId) {
    return false;
  }

  const collection = await getSubmissionCollection();
  const result = await collection.deleteOne({
    _id: objectId,
  });

  return result.deletedCount === 1;
}

async function findBaselineDocument(document: SubmissionDocument) {
  const baselineSubmissionId = document.comparison?.baselineSubmissionId;
  const objectId = baselineSubmissionId ? toObjectId(baselineSubmissionId) : null;

  if (!objectId) {
    return null;
  }

  const collection = await getSubmissionCollection();

  return collection.findOne({
    _id: objectId,
  });
}

function toModelRun(
  document: WithId<SubmissionDocument>,
  baseline: WithId<SubmissionDocument> | null,
): SubmissionModelRun {
  const isBaseline = baseline !== null && document._id.equals(baseline._id);

  return {
    agreement:
      baseline && !isBaseline
        ? computeSubmissionAgreement(baseline, document.extraction)
        : null,
    createdAt: document.createdAt.toISOString(),
    isBaseline,
    providerMeta: document.extraction.providerMeta,
    reviewProgress: deriveReviewProgress(countReviewDecisions(document.review)),
    reviewStatus: deriveSubmissionReviewStatus(document.review),
    submissionId: document._id.toHexString(),
  };
}

/**
 * Lists the baseline submission followed by every re-run made from it, oldest
 * first, with each re-run's agreement against the baseline.
 */
export async function listSubmissionModelRuns(
  rootSubmissionId: string,
): Promise<SubmissionModelRun[]> {
  const rootObjectId = toObjectId(rootSubmissionId);

  if (!rootObjectId) {
    return [];
  }

  const collection = await getSubmissionCollection();
  const [root, reruns] = await Promise.all([
    collection.findOne({
      _id: rootObjectId,
    }),
    collection
      .find({
        "comparison.baselineSubmissionId": rootSubmissionId,
      })
      .sort({
        createdAt: 1,
      })
      .toArray(),
  ]);
  const runs = root ? [toModelRun(root, root)] : [];

  for (const rerun of reruns) {
    runs.push(toModelRun(rerun, root));
  }

  return runs;
}

/** Number of baselines (not re-runs) whose review still has pending decisions. */
export async function getReviewQueueCount(): Promise<number> {
  const collection = await getSubmissionCollection();

  return collection.countDocuments({
    comparison: { $exists: false },
    reviewStatus: "pending",
  });
}

/* ------------------------------------------------------------------------- */
/* Redesign data access (Sept 2026)                                           */
/* ------------------------------------------------------------------------- */

/** Everything but the extraction payload, plus its provider metadata. */
type LeanSubmissionDocument = Omit<SubmissionDocument, "extraction"> & {
  extraction: Pick<ExtractionSnapshot, "providerMeta">;
};

const LEAN_PROJECTION = {
  comparison: 1,
  createdAt: 1,
  "extraction.providerMeta": 1,
  intake: 1,
  review: 1,
  reviewStatus: 1,
  reviewedAt: 1,
  updatedAt: 1,
} as const;

async function findLeanDocuments(
  filter: Record<string, unknown> = {},
): Promise<Array<WithId<LeanSubmissionDocument>>> {
  const collection = await getSubmissionCollection();

  return (await collection
    .find(filter, { projection: LEAN_PROJECTION })
    .toArray()) as unknown as Array<WithId<LeanSubmissionDocument>>;
}

function toReviewProgress(review: SubmissionHumanReview): ReviewProgress {
  return deriveReviewProgress(countReviewDecisions(review));
}

function reviewedAtIso(document: Pick<SubmissionDocument, "review" | "reviewedAt">) {
  return deriveSubmissionReviewStatus(document.review) === "reviewed"
    ? toIsoString(document.reviewedAt)
    : null;
}

function maxIso(values: string[]) {
  return values.reduce((latest, value) => (value > latest ? value : latest));
}

function toGroupBaseline(document: WithId<LeanSubmissionDocument>): DatasheetGroupBaseline {
  const submissionId = document._id.toHexString();
  const pdf = getSubmissionPdfHref(submissionId, document.intake.sourceMeta);

  return {
    createdAt: document.createdAt.toISOString(),
    packageCategory: document.intake.packageCategory,
    partNumber: document.intake.partNumber,
    pdfAvailable: pdf.available,
    pdfHref: pdf.available ? pdf.href : null,
    providerMeta: document.extraction.providerMeta,
    reviewProgress: toReviewProgress(document.review),
    reviewedAt: reviewedAtIso(document),
    source: describeSubmissionSource(document.intake.sourceMeta),
    submissionId,
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toListRun(
  document: WithId<LeanSubmissionDocument>,
  agreement: SubmissionAgreement | null,
): SubmissionListRun {
  return {
    agreementBasis: agreement?.basis ?? null,
    agreementPercentage: agreement?.agreementPercentage ?? null,
    baselineReviewStatus: agreement?.baselineReviewStatus ?? null,
    baselineReviewedDecisions: agreement?.baselineReviewedDecisions ?? null,
    baselineTotalDecisions: agreement?.baselineTotalDecisions ?? null,
    createdAt: document.createdAt.toISOString(),
    isScored: isScoredAgreement(agreement),
    providerMeta: document.extraction.providerMeta,
    reviewProgress: toReviewProgress(document.review),
    submissionId: document._id.toHexString(),
  };
}

function matchesSearch(document: LeanSubmissionDocument, needle: string) {
  if (!needle) {
    return true;
  }

  const source = describeSubmissionSource(document.intake.sourceMeta);
  const haystacks = [document.intake.partNumber, source.fileName, source.host ?? ""];

  if (document.intake.sourceMeta.kind === "upload") {
    haystacks.push(document.intake.sourceMeta.fileName);
  }

  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

function comparePartNumbers(left: string, right: string) {
  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

type GroupDraft = {
  baselineDocument: WithId<LeanSubmissionDocument>;
  isOrphanRun: boolean;
  lastActivityAt: string;
  progress: ReviewProgress;
  runDocuments: Array<WithId<LeanSubmissionDocument>>;
};

function sortGroupDrafts(drafts: GroupDraft[], sort: DatasheetListQuery["sort"]) {
  const byRecent = (left: GroupDraft, right: GroupDraft) =>
    right.lastActivityAt.localeCompare(left.lastActivityAt);
  const byNewest = (left: GroupDraft, right: GroupDraft) =>
    right.baselineDocument.createdAt.getTime() - left.baselineDocument.createdAt.getTime();

  return [...drafts].sort((left, right) => {
    switch (sort) {
      case "newest":
        return byNewest(left, right);
      case "part":
        return (
          comparePartNumbers(
            left.baselineDocument.intake.partNumber,
            right.baselineDocument.intake.partNumber,
          ) || byNewest(left, right)
        );
      case "pending":
        return right.progress.pending - left.progress.pending || byRecent(left, right);
      case "recent":
      default:
        return byRecent(left, right) || byNewest(left, right);
    }
  });
}

/**
 * Groups for /submissions: one per baseline with its re-runs nested (oldest
 * first). Re-runs whose baseline was deleted form their own group, shown only
 * under status "all". Counts cover baselines only and reflect q and category
 * but not status; totals cover every baseline regardless of the query.
 */
export async function listDatasheetGroups(
  query: DatasheetListQuery,
): Promise<DatasheetListResult> {
  const documents = await findLeanDocuments();
  const baselines = documents.filter((document) => !document.comparison);
  const baselineIds = new Set(baselines.map((document) => document._id.toHexString()));
  const runsByBaseline = new Map<string, Array<WithId<LeanSubmissionDocument>>>();
  const orphanRuns: Array<WithId<LeanSubmissionDocument>> = [];

  for (const document of documents) {
    const baselineId = document.comparison?.baselineSubmissionId;

    if (!baselineId) {
      continue;
    }

    if (!baselineIds.has(baselineId)) {
      orphanRuns.push(document);
      continue;
    }

    const runs = runsByBaseline.get(baselineId);

    if (runs) {
      runs.push(document);
    } else {
      runsByBaseline.set(baselineId, [document]);
    }
  }

  const partNumberCounts = new Map<string, number>();

  for (const baseline of baselines) {
    const key = normalizePartNumberKey(baseline.intake.partNumber);

    partNumberCounts.set(key, (partNumberCounts.get(key) ?? 0) + 1);
  }

  const needle = query.q.trim().toLowerCase();
  const matchesScope = (document: LeanSubmissionDocument) =>
    (query.category === null || document.intake.packageCategory === query.category) &&
    matchesSearch(document, needle);

  const scopedBaselines: GroupDraft[] = baselines.filter(matchesScope).map((document) => {
    const runDocuments = (runsByBaseline.get(document._id.toHexString()) ?? []).sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );

    return {
      baselineDocument: document,
      isOrphanRun: false,
      lastActivityAt: maxIso([
        document.updatedAt.toISOString(),
        ...runDocuments.map((run) => run.createdAt.toISOString()),
      ]),
      progress: toReviewProgress(document.review),
      runDocuments,
    };
  });

  const counts = {
    all: scopedBaselines.length,
    needsReview: scopedBaselines.filter((draft) => draft.progress.pending > 0).length,
    reviewed: scopedBaselines.filter((draft) => draft.progress.pending === 0).length,
  };
  const totals = {
    all: baselines.length,
    needsReview: baselines.filter((document) => toReviewProgress(document.review).pending > 0)
      .length,
  };

  let drafts: GroupDraft[];

  if (query.status === "needs-review") {
    drafts = scopedBaselines.filter((draft) => draft.progress.pending > 0);
  } else if (query.status === "reviewed") {
    drafts = scopedBaselines.filter((draft) => draft.progress.pending === 0);
  } else {
    drafts = [
      ...scopedBaselines,
      ...orphanRuns.filter(matchesScope).map((document) => ({
        baselineDocument: document,
        isOrphanRun: true,
        lastActivityAt: maxIso([
          document.createdAt.toISOString(),
          document.updatedAt.toISOString(),
        ]),
        progress: toReviewProgress(document.review),
        runDocuments: [],
      })),
    ];
  }

  const limit = Math.max(1, Math.floor(query.limit) || 1);
  const sorted = sortGroupDrafts(drafts, query.sort);
  const page = sorted.slice(0, limit);
  const agreements = await computeGroupAgreements(page);

  const groups: DatasheetGroup[] = page.map((draft) => {
    const runs = draft.runDocuments.map((run) =>
      toListRun(run, agreements.get(run._id.toHexString()) ?? null),
    );
    const scored = runs
      .filter((run) => run.isScored && run.agreementPercentage !== null)
      .map((run) => run.agreementPercentage as number);
    const partNumberKey = normalizePartNumberKey(draft.baselineDocument.intake.partNumber);
    const sameParts = partNumberCounts.get(partNumberKey) ?? 0;

    return {
      baseline: toGroupBaseline(draft.baselineDocument),
      duplicateCount: Math.max(0, draft.isOrphanRun ? sameParts : sameParts - 1),
      isOrphanRun: draft.isOrphanRun,
      lastActivityAt: draft.lastActivityAt,
      runs,
      scoredAgreementRange:
        scored.length > 0 ? { max: Math.max(...scored), min: Math.min(...scored) } : null,
    };
  });

  const presentCategories = new Set<PackageCategory>(
    baselines.map((document) => document.intake.packageCategory),
  );

  return {
    categories: packageCategories.filter((category) => presentCategories.has(category)),
    counts,
    groups,
    hasMore: sorted.length > limit,
    totals,
  };
}

/**
 * Loads the full extractions for the visible groups that have runs and
 * computes each run's agreement against its baseline (on read, never stored).
 */
async function computeGroupAgreements(drafts: GroupDraft[]) {
  const agreements = new Map<string, SubmissionAgreement>();
  const withRuns = drafts.filter((draft) => draft.runDocuments.length > 0);

  if (withRuns.length === 0) {
    return agreements;
  }

  const ids = withRuns.flatMap((draft) => [
    draft.baselineDocument._id,
    ...draft.runDocuments.map((run) => run._id),
  ]);
  const collection = await getSubmissionCollection();
  const fullDocuments = await collection
    .find({ _id: { $in: ids } }, { projection: { extraction: 1, review: 1 } })
    .toArray();
  const byId = new Map(
    fullDocuments.map((document) => [document._id.toHexString(), document] as const),
  );

  for (const draft of withRuns) {
    const baseline = byId.get(draft.baselineDocument._id.toHexString());

    if (!baseline) {
      continue;
    }

    for (const run of draft.runDocuments) {
      const runDocument = byId.get(run._id.toHexString());

      if (runDocument) {
        agreements.set(
          run._id.toHexString(),
          computeSubmissionAgreement(baseline, runDocument.extraction),
        );
      }
    }
  }

  return agreements;
}

/** Baselines only, newest first, for the intake duplicate check and recent list. */
export async function listDatasheetIndex(): Promise<DatasheetIndexEntry[]> {
  const collection = await getSubmissionCollection();
  const [baselines, runLinks] = await Promise.all([
    collection
      .find(
        { comparison: { $exists: false } },
        { projection: { createdAt: 1, intake: 1, review: 1 } },
      )
      .sort({ createdAt: -1 })
      .toArray(),
    collection
      .find(
        { comparison: { $exists: true } },
        { projection: { "comparison.baselineSubmissionId": 1 } },
      )
      .toArray(),
  ]);
  const runCounts = new Map<string, number>();

  for (const link of runLinks) {
    const baselineId = link.comparison?.baselineSubmissionId;

    if (baselineId) {
      runCounts.set(baselineId, (runCounts.get(baselineId) ?? 0) + 1);
    }
  }

  return baselines.map((document) => {
    const submissionId = document._id.toHexString();
    const sourceMeta = document.intake.sourceMeta;

    return {
      createdAt: document.createdAt.toISOString(),
      normalizedPartNumber: normalizePartNumberKey(document.intake.partNumber),
      normalizedUrl: sourceMeta.kind === "url" ? sourceMeta.normalizedUrl : null,
      packageCategory: document.intake.packageCategory,
      partNumber: document.intake.partNumber,
      pdfRetained: sourceMeta.kind === "url" || hasRetainedUploadSource(sourceMeta),
      reviewProgress: toReviewProgress(document.review),
      runCount: runCounts.get(submissionId) ?? 0,
      submissionId,
    };
  });
}

/** The oldest pending baseline other than `excludeId`, for "Next to review". */
export async function findNextPendingBaseline(
  excludeId: string | null,
): Promise<NextReviewTarget | null> {
  const collection = await getSubmissionCollection();
  const excludeObjectId = excludeId ? toObjectId(excludeId) : null;
  const document = await collection.findOne(
    {
      comparison: { $exists: false },
      reviewStatus: "pending",
      ...(excludeObjectId ? { _id: { $ne: excludeObjectId } } : {}),
    },
    {
      projection: { "intake.partNumber": 1 },
      sort: { createdAt: 1, _id: 1 },
    },
  );

  if (!document) {
    return null;
  }

  return {
    partNumber: document.intake.partNumber,
    submissionId: document._id.toHexString(),
  };
}

function countDecisionStatuses(
  statuses: Array<SubmissionHumanReview["pins"][number]["status"]>,
): ReviewDecisionCounts {
  const counts: ReviewDecisionCounts = {
    confirmed: 0,
    corrected: 0,
    pending: 0,
    total: statuses.length,
  };

  for (const status of statuses) {
    counts[status] += 1;
  }

  return counts;
}

/** Every submission with per-row decisions, for the Reports page. Newest first. */
export async function listReportSubmissions(): Promise<ReportSubmission[]> {
  const collection = await getSubmissionCollection();
  const documents = await collection.find({}).sort({ createdAt: -1 }).toArray();
  const documentsById = new Map(
    documents.map((document) => [document._id.toHexString(), document] as const),
  );

  return documents.map((document) => {
    const baselineId = document.comparison?.baselineSubmissionId ?? null;
    const summary = mapSubmissionSummary(
      document,
      baselineId ? (documentsById.get(baselineId) ?? null) : null,
    );

    return {
      ...summary,
      isBaseline: !document.comparison,
      measurementDecisions: document.review.measurements.map((entry) => ({
        field: entry.field,
        status: entry.status,
      })),
      packageDecision: document.review.packageSelection.status,
      pinDecisionCounts: countDecisionStatuses(document.review.pins.map((entry) => entry.status)),
      rootSubmissionId: baselineId ?? summary.submissionId,
    };
  });
}

/**
 * Lean run metadata for intake estimates via `summarizeModelRuns`. Latency,
 * cost and accuracy are exact; `comparison.agreement` is always null (the
 * comparison is kept only so re-runs count as re-runs).
 */
export async function listRunMetaSummaries(): Promise<RunMetaSummary[]> {
  const collection = await getSubmissionCollection();
  const documents = (await collection
    .find(
      {},
      {
        projection: {
          comparison: 1,
          "extraction.providerMeta": 1,
          review: 1,
        },
      },
    )
    .toArray()) as unknown as Array<
    WithId<Pick<SubmissionDocument, "comparison" | "review">> & {
      extraction: { providerMeta: ProviderMeta };
    }
  >;

  return documents.map((document) => {
    const reviewDecisionCounts = countReviewDecisions(document.review);

    return {
      ...(document.comparison
        ? {
            comparison: {
              agreement: null,
              baseline: null,
              baselineSubmissionId: document.comparison.baselineSubmissionId,
            },
          }
        : {}),
      providerMeta: document.extraction.providerMeta,
      reviewDecisionCounts,
      reviewStatus: reviewDecisionCounts.pending === 0 ? "reviewed" : "pending",
    };
  });
}

/** Intake only (lean), for the PDF routes. */
export async function getSubmissionIntake(
  submissionId: string,
): Promise<{ intake: SubmissionIntakeSnapshot; submissionId: string } | null> {
  const objectId = toObjectId(submissionId);

  if (!objectId) {
    return null;
  }

  const collection = await getSubmissionCollection();
  const document = await collection.findOne(
    { _id: objectId },
    { projection: { intake: 1 } },
  );

  return document ? { intake: document.intake, submissionId } : null;
}

const URL_CACHE_OBJECT_PREFIX = "datasheets/url-cache/";

/**
 * Deletes a submission and every re-run compared against it (Mongo only).
 * Returns the deleted ids and the retained upload object keys so the caller
 * can delete those R2 objects best-effort afterwards (addendum Q). Never
 * returns url-cache keys. Resolves empty when the root does not exist.
 */
export async function deleteSubmissionWithRuns(
  rootId: string,
): Promise<{ deletedIds: string[]; uploadObjectKeys: string[] }> {
  const rootObjectId = toObjectId(rootId);

  if (!rootObjectId) {
    return { deletedIds: [], uploadObjectKeys: [] };
  }

  const collection = await getSubmissionCollection();
  const root = await collection.findOne(
    { _id: rootObjectId },
    { projection: { _id: 1 } },
  );

  if (!root) {
    return { deletedIds: [], uploadObjectKeys: [] };
  }

  const deletedIds = new Set<string>();
  const uploadObjectKeys = new Set<string>();
  const filter = {
    $or: [{ _id: rootObjectId }, { "comparison.baselineSubmissionId": rootId }],
  };

  // Repeat once or twice so a run that lands mid-delete is not left orphaned.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const targets = await collection
      .find(filter, { projection: { "intake.sourceMeta": 1 } })
      .toArray();

    if (targets.length === 0) {
      break;
    }

    const result = await collection.deleteMany({
      _id: { $in: targets.map((target) => target._id) },
    });

    for (const target of targets) {
      deletedIds.add(target._id.toHexString());

      const sourceMeta = target.intake.sourceMeta;

      if (
        hasRetainedUploadSource(sourceMeta) &&
        !sourceMeta.objectKey.startsWith(URL_CACHE_OBJECT_PREFIX)
      ) {
        uploadObjectKeys.add(sourceMeta.objectKey);
      }
    }

    if (result.deletedCount === 0) {
      break;
    }
  }

  return {
    deletedIds: Array.from(deletedIds),
    uploadObjectKeys: Array.from(uploadObjectKeys),
  };
}
