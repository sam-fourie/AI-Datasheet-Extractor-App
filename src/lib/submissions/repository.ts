import {
  type Collection,
  ObjectId,
  type WithId,
} from "mongodb";

import { getMongoDatabase } from "@/lib/mongodb";
import {
  countReviewDecisions,
  createDefaultSubmissionReview,
  deriveSubmissionReviewStatus,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import type {
  ExtractionSnapshot,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionIntakeSnapshot,
  SubmissionReviewPayload,
  SubmissionReviewStatus,
  SubmissionSummary,
} from "@/lib/submissions/types";

const COLLECTION_NAME = "datasheet_submissions";

type SubmissionDocument = {
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

function mapSubmissionDocument(
  document: WithId<SubmissionDocument>,
): SubmissionDetail {
  const reviewStatus = deriveSubmissionReviewStatus(document.review);

  return {
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

function mapSubmissionSummary(document: WithId<SubmissionDocument>): SubmissionSummary {
  const detail = mapSubmissionDocument(document);

  return {
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
  extraction: ExtractionSnapshot;
  intake: SubmissionIntakeSnapshot;
}): Promise<SubmissionDetail> {
  const collection = await getSubmissionCollection();
  const now = new Date();
  const review = createDefaultSubmissionReview(input.extraction);
  const reviewStatus = deriveSubmissionReviewStatus(review);
  const document: SubmissionDocument = {
    createdAt: now,
    extraction: input.extraction,
    intake: input.intake,
    review,
    reviewedAt: reviewStatus === "reviewed" ? now : null,
    reviewStatus,
    updatedAt: now,
  };
  const result = await collection.insertOne(document);

  return mapSubmissionDocument({
    ...document,
    _id: result.insertedId,
  });
}

export async function listSubmissionSummaries() {
  const collection = await getSubmissionCollection();
  const documents = await collection
    .find({})
    .sort({
      createdAt: -1,
    })
    .toArray();

  return documents.map(mapSubmissionSummary);
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

  return document ? mapSubmissionDocument(document) : null;
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

  return mapSubmissionDocument({
    ...existingDocument,
    _id: objectId,
    review,
    reviewedAt,
    reviewStatus,
    updatedAt,
  });
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
