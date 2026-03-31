import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";

import {
  extractDatasheet,
  type ExtractionMeasurement,
  type ExtractionPin,
} from "@/lib/ai";
import type {
  ExtractionRequestPayload,
  UploadedPdfPayload,
} from "@/lib/extractions";
import {
  PACKAGE_CATEGORY_FIELDS,
  type MeasurementFieldRow,
  type PackageCategory,
  type PinRow,
} from "@/lib/package-categories";
import { MongoConfigError } from "@/lib/mongodb";
import {
  buildPdfDisplayFileName,
  looksLikePdf,
  MAX_PDF_BYTES,
  normalizePdfFileName,
  PDF_MIME_TYPE,
} from "@/lib/pdf";
import { PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";
import {
  buildSubmissionPdfObjectKey,
  copyObject,
  deleteObject,
  downloadObjectBytes,
  getR2BucketName,
  isPendingPdfObjectKey,
  R2ConfigError,
} from "@/lib/r2";
import {
  createSubmission,
  type ExtractionSnapshot,
  type SubmissionDetail,
  type SubmissionIntakeSnapshot,
  type UploadSourceMeta,
} from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 300;

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

function assertPackageCategory(value: string): asserts value is PackageCategory {
  if (!Object.prototype.hasOwnProperty.call(PACKAGE_CATEGORY_FIELDS, value)) {
    throw new RouteError("Please choose a valid package category.", 400);
  }
}

function getObjectValue(value: unknown, message: string) {
  if (!value || typeof value !== "object") {
    throw new RouteError(message, 400);
  }

  return value as Record<string, unknown>;
}

function getStringValue(value: unknown, key: string) {
  if (typeof value !== "string") {
    throw new RouteError(`Missing required field: ${key}.`, 400);
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new RouteError(`Missing required field: ${key}.`, 400);
  }

  return trimmedValue;
}

function ensurePdfSize(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new RouteError("PDF exceeds the 20 MB upload limit for v1.", 413);
  }
}

function parseUploadedPdfPayload(payload: unknown): UploadedPdfPayload {
  const value = getObjectValue(payload, "Uploaded PDF metadata is required.");
  const fileName = getStringValue(value.fileName, "uploadedPdf.fileName");
  const mimeType = getStringValue(value.mimeType, "uploadedPdf.mimeType");
  const objectKey = getStringValue(value.objectKey, "uploadedPdf.objectKey");
  const sizeBytes = value.sizeBytes;

  if (!Number.isFinite(sizeBytes) || typeof sizeBytes !== "number" || sizeBytes <= 0) {
    throw new RouteError("Missing required field: uploadedPdf.sizeBytes.", 400);
  }

  if (mimeType !== PDF_MIME_TYPE) {
    throw new RouteError("Uploaded file must be a PDF.", 400);
  }

  if (sizeBytes > MAX_PDF_BYTES) {
    throw new RouteError("PDF exceeds the 20 MB upload limit for v1.", 413);
  }

  if (!isPendingPdfObjectKey(objectKey)) {
    throw new RouteError("Uploaded PDF key is invalid. Please upload the file again.", 400);
  }

  return {
    fileName,
    mimeType,
    objectKey,
    sizeBytes,
  };
}

function parseExtractionPayload(payload: unknown): ExtractionRequestPayload {
  const value = getObjectValue(payload, "Extraction request payload must be a JSON object.");
  const sourceMode = getStringValue(value.sourceMode, "sourceMode");
  const partNumber = getStringValue(value.partNumber, "partNumber");
  const packageCategoryValue = getStringValue(value.packageCategory, "packageCategory");

  if (sourceMode !== "upload" && sourceMode !== "url") {
    throw new RouteError("Please choose a valid PDF source mode.", 400);
  }

  assertPackageCategory(packageCategoryValue);

  if (sourceMode === "upload") {
    return {
      packageCategory: packageCategoryValue,
      partNumber,
      sourceMode,
      uploadedPdf: parseUploadedPdfPayload(value.uploadedPdf),
    };
  }

  return {
    datasheetUrl: getStringValue(value.datasheetUrl, "datasheetUrl"),
    packageCategory: packageCategoryValue,
    partNumber,
    sourceMode,
  };
}

async function readUploadedPdf(uploadedPdf: UploadedPdfPayload) {
  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await downloadObjectBytes(uploadedPdf.objectKey);
  } catch {
    throw new RouteError("Uploaded PDF could not be read. Please upload the file again.", 400);
  }

  ensurePdfSize(pdfBytes);

  if (!looksLikePdf(pdfBytes)) {
    throw new RouteError("Uploaded file does not appear to be a valid PDF.", 400);
  }

  const checksumSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const fileName = buildPdfDisplayFileName(uploadedPdf.fileName);

  return {
    cleanupObjectKey: uploadedPdf.objectKey,
    pdfBytes,
    pdfFileName: normalizePdfFileName(fileName),
    sourceLabel: fileName,
    sourceMeta: {
      checksumSha256,
      fileName,
      kind: "upload",
      mimeType: PDF_MIME_TYPE,
      sizeBytes: pdfBytes.byteLength,
    } satisfies UploadSourceMeta,
  };
}

function toFieldRow(measurement: ExtractionMeasurement): MeasurementFieldRow {
  const status =
    measurement.status === "not_found"
      ? "Not found"
      : measurement.status === "needs_review"
        ? "Needs review"
        : "Extracted";

  return {
    confidence: measurement.confidence,
    evidencePages: measurement.evidencePages,
    field: measurement.field,
    status,
    value: measurement.value ?? "Not found in datasheet",
  };
}

function toPinRow(pin: ExtractionPin): PinRow {
  return {
    confidence: pin.confidence,
    evidencePages: pin.evidencePages,
    pinName: pin.pinName,
    pinNumber: pin.pinNumber,
  };
}

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof PdfSourceError) {
    return error;
  }

  if (error instanceof MongoConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof R2ConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected extraction error.", 500);
}

async function cleanupUploadedObjects(objectKeys: Array<string | null | undefined>) {
  for (const objectKey of objectKeys) {
    if (!objectKey) {
      continue;
    }

    try {
      await deleteObject(objectKey);
    } catch {
      // Lifecycle cleanup on the bucket covers failed deletes.
    }
  }
}

export async function POST(request: Request) {
  let pendingObjectKey: string | null = null;
  let permanentObjectKey: string | null = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new RouteError("OPENAI_API_KEY is not configured on the server.", 500);
    }

    const payload = parseExtractionPayload(await request.json().catch(() => null));

    const pdfSource =
      payload.sourceMode === "upload"
        ? await readUploadedPdf(payload.uploadedPdf)
        : await readPdfFromUrl(payload.datasheetUrl);

    if ("cleanupObjectKey" in pdfSource) {
      pendingObjectKey = pdfSource.cleanupObjectKey;
    }

    const extraction = await extractDatasheet({
      packageCategory: payload.packageCategory,
      partNumber: payload.partNumber,
      pdfBytes: pdfSource.pdfBytes,
      pdfFileName: pdfSource.pdfFileName,
      requestedFields: PACKAGE_CATEGORY_FIELDS[payload.packageCategory],
      sourceLabel: pdfSource.sourceLabel,
    });

    const extractionSnapshot: ExtractionSnapshot = {
      fields: extraction.measurements.map(toFieldRow),
      packageSelection: extraction.packageSelection,
      pinRows: extraction.pins.map(toPinRow),
      providerMeta: extraction.providerMeta,
      review: extraction.review,
    };

    let submissionId: string | undefined;
    let intakeSnapshot: SubmissionIntakeSnapshot;

    if (payload.sourceMode === "upload") {
      const uploadSourceMeta = pdfSource.sourceMeta as UploadSourceMeta;

      submissionId = new ObjectId().toHexString();
      permanentObjectKey = buildSubmissionPdfObjectKey(
        submissionId,
        uploadSourceMeta.fileName,
      );
      await copyObject(payload.uploadedPdf.objectKey, permanentObjectKey);

      intakeSnapshot = {
        packageCategory: payload.packageCategory,
        partNumber: payload.partNumber,
        requestedFields: [...PACKAGE_CATEGORY_FIELDS[payload.packageCategory]],
        sourceLabel: pdfSource.sourceLabel,
        sourceMeta: {
          ...uploadSourceMeta,
          bucketName: getR2BucketName(),
          objectKey: permanentObjectKey,
          storageProvider: "cloudflare-r2",
        },
        sourceMode: payload.sourceMode,
      };
    } else {
      intakeSnapshot = {
        packageCategory: payload.packageCategory,
        partNumber: payload.partNumber,
        requestedFields: [...PACKAGE_CATEGORY_FIELDS[payload.packageCategory]],
        sourceLabel: pdfSource.sourceLabel,
        sourceMeta: pdfSource.sourceMeta,
        sourceMode: payload.sourceMode,
      };
    }

    const submission = await createSubmission({
      extraction: extractionSnapshot,
      intake: intakeSnapshot,
      submissionId,
    });

    if (pendingObjectKey) {
      await cleanupUploadedObjects([pendingObjectKey]);
      pendingObjectKey = null;
    }

    return Response.json(submission satisfies SubmissionDetail);
  } catch (error) {
    if (pendingObjectKey || permanentObjectKey) {
      await cleanupUploadedObjects([pendingObjectKey, permanentObjectKey]);
    }

    const routeError = toRouteError(error);

    return Response.json(
      {
        error: routeError.message,
      },
      {
        status: routeError.status,
      },
    );
  }
}
