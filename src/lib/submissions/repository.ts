import {
  type Collection,
  ObjectId,
  type WithId,
} from "mongodb";

import { getMongoDatabase } from "@/lib/mongodb";
import { computeSubmissionAgreement } from "@/lib/submissions/agreement";
import {
  countReviewDecisions,
  createDefaultSubmissionReview,
  deriveSubmissionReviewStatus,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import type {
  ExtractionSnapshot,
  SubmissionBaselineRef,
  SubmissionComparison,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionIntakeSnapshot,
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

export function isValidSubmissionId(submissionId: string) {
  return ObjectId.isValid(submissionId);
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
