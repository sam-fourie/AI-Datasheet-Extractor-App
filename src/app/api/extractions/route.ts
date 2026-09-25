import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";
import { after } from "next/server";

import { requireAuthorizedRequest } from "@/app/api/_lib/access";
import { extractDatasheet } from "@/lib/ai";
import {
  ExtractionCancelledError,
  ExtractionTimeoutError,
} from "@/lib/ai/errors";
import {
  ExtractionSettingsError,
  resolveExtractionSettings,
  type ExtractionSettings,
} from "@/lib/ai/settings";
import type {
  ExtractionErrorCode,
  ExtractionErrorResponse,
  ExtractionRequestPayload,
  UploadedPdfPayload,
} from "@/lib/extractions";
import {
  PACKAGE_CATEGORY_FIELDS,
  type PackageCategory,
} from "@/lib/package-categories";
import { MongoConfigError } from "@/lib/mongodb";
import {
  buildPdfDisplayFileName,
  looksLikePdf,
  MAX_PDF_BYTES,
  normalizePdfFileName,
  PDF_MIME_TYPE,
  PDF_UPLOAD_LIMIT_MESSAGE,
} from "@/lib/pdf";
import { cacheUrlSourcePdf } from "@/lib/pdf-cache";
import {
  isPdfSourceCancelled,
  PdfSourceError,
  readPdfFromUrl,
} from "@/lib/pdf-source";
import {
  buildSubmissionPdfObjectKey,
  copyObject,
  deleteObject,
  downloadObjectBytes,
  getR2BucketName,
  headObject,
  isPendingPdfObjectKey,
  R2ConfigError,
  R2ObjectTooLargeError,
} from "@/lib/r2";
import {
  buildExtractionSnapshot,
  createSubmission,
  type SubmissionDetail,
  type SubmissionIntakeSnapshot,
  type UploadSourceMeta,
  type UrlSourceMeta,
} from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 300;

type ParsedExtractionRequest = ExtractionRequestPayload & ExtractionSettings;

/** Status 499 (client closed request) for a cancelled extraction. */
const CANCELLED_STATUS = 499;

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ExtractionErrorCode = "invalid-request",
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
    throw new RouteError(PDF_UPLOAD_LIMIT_MESSAGE, 413, "too-large");
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
    throw new RouteError("Uploaded file must be a PDF.", 400, "invalid-pdf");
  }

  if (sizeBytes > MAX_PDF_BYTES) {
    throw new RouteError(PDF_UPLOAD_LIMIT_MESSAGE, 413, "too-large");
  }

  if (!isPendingPdfObjectKey(objectKey)) {
    throw new RouteError(
      "Uploaded PDF key is invalid. Please upload the file again.",
      400,
      "upload-failed",
    );
  }

  return {
    fileName,
    mimeType,
    objectKey,
    sizeBytes,
  };
}

function resolveRequestedExtractionSettings(value: Record<string, unknown>) {
  try {
    return resolveExtractionSettings({
      model: value.model,
      reasoningEffort: value.reasoningEffort,
    });
  } catch (error) {
    if (error instanceof ExtractionSettingsError) {
      throw new RouteError(error.message, 400);
    }

    throw error;
  }
}

function parseExtractionPayload(payload: unknown): ParsedExtractionRequest {
  const value = getObjectValue(payload, "Extraction request payload must be a JSON object.");
  const sourceMode = getStringValue(value.sourceMode, "sourceMode");
  const partNumber = getStringValue(value.partNumber, "partNumber");
  const packageCategoryValue = getStringValue(value.packageCategory, "packageCategory");

  if (sourceMode !== "upload" && sourceMode !== "url") {
    throw new RouteError("Please choose a valid PDF source mode.", 400);
  }

  assertPackageCategory(packageCategoryValue);

  const settings = resolveRequestedExtractionSettings(value);

  if (sourceMode === "upload") {
    return {
      model: settings.model,
      packageCategory: packageCategoryValue,
      partNumber,
      reasoningEffort: settings.reasoningEffort,
      sourceMode,
      uploadedPdf: parseUploadedPdfPayload(value.uploadedPdf),
    };
  }

  return {
    datasheetUrl: getStringValue(value.datasheetUrl, "datasheetUrl"),
    model: settings.model,
    packageCategory: packageCategoryValue,
    partNumber,
    reasoningEffort: settings.reasoningEffort,
    sourceMode,
  };
}

const UPLOAD_UNREADABLE_MESSAGE = "Uploaded PDF could not be read. Please upload the file again.";

/**
 * Checks the stored object's size before reading it, so an object larger than
 * the limit (or than the upload claimed) is never downloaded into memory.
 */
async function ensureUploadedObjectSize(uploadedPdf: UploadedPdfPayload) {
  let head: Awaited<ReturnType<typeof headObject>>;

  try {
    head = await headObject(uploadedPdf.objectKey);
  } catch (error) {
    if (error instanceof R2ConfigError) {
      throw error;
    }

    throw new RouteError(UPLOAD_UNREADABLE_MESSAGE, 400, "upload-failed");
  }

  if (!head.exists) {
    throw new RouteError(UPLOAD_UNREADABLE_MESSAGE, 400, "upload-failed");
  }

  if (head.contentLength === null || head.contentLength > MAX_PDF_BYTES) {
    throw new RouteError(PDF_UPLOAD_LIMIT_MESSAGE, 413, "too-large");
  }

  // The upload URL signs the declared length, so a mismatch means the object
  // is not the file this request describes.
  if (head.contentLength !== uploadedPdf.sizeBytes) {
    throw new RouteError(UPLOAD_UNREADABLE_MESSAGE, 400, "upload-failed");
  }
}

async function readUploadedPdf(uploadedPdf: UploadedPdfPayload) {
  await ensureUploadedObjectSize(uploadedPdf);

  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await downloadObjectBytes(uploadedPdf.objectKey, MAX_PDF_BYTES);
  } catch (error) {
    if (error instanceof R2ObjectTooLargeError) {
      throw new RouteError(PDF_UPLOAD_LIMIT_MESSAGE, 413, "too-large");
    }

    throw new RouteError(UPLOAD_UNREADABLE_MESSAGE, 400, "upload-failed");
  }

  ensurePdfSize(pdfBytes);

  if (!looksLikePdf(pdfBytes)) {
    throw new RouteError("Uploaded file does not appear to be a valid PDF.", 400, "invalid-pdf");
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

function isValidAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Maps pdf-source failures (which carry only a status) onto §2.2 codes. */
function codeForPdfSourceError(error: PdfSourceError): ExtractionErrorCode {
  if (error.status === 413) {
    return "too-large";
  }

  if (/valid PDF/i.test(error.message)) {
    return "invalid-pdf";
  }

  if (/Missing required field|valid absolute URL/i.test(error.message)) {
    return "invalid-request";
  }

  return "source-unreachable";
}

function toRouteError(error: unknown): RouteError {
  if (error instanceof RouteError) {
    return error;
  }

  // A cancel during the vendor download surfaces as a 499 PdfSourceError.
  if (error instanceof ExtractionCancelledError || isPdfSourceCancelled(error)) {
    return new RouteError("Extraction cancelled.", CANCELLED_STATUS, "cancelled");
  }

  if (error instanceof PdfSourceError) {
    return new RouteError(error.message, error.status, codeForPdfSourceError(error));
  }

  if (error instanceof ExtractionTimeoutError) {
    return new RouteError(error.message, 504, "timeout");
  }

  if (error instanceof MongoConfigError || error instanceof R2ConfigError) {
    return new RouteError(error.message, 500, "not-configured");
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500, "unknown");
  }

  return new RouteError("Unexpected extraction error.", 500, "unknown");
}

function errorResponse(routeError: RouteError, retryableUpload = false) {
  const body: ExtractionErrorResponse = {
    code: routeError.code,
    error: routeError.message,
    ...(retryableUpload ? { retryableUpload: true } : {}),
  };

  return Response.json(body, { status: routeError.status });
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
  const unauthorized = requireAuthorizedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  let pendingObjectKey: string | null = null;
  let permanentObjectKey: string | null = null;
  // Set while the model call runs: model-side failures keep the pending upload (addendum T).
  let inModelStage = false;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new RouteError(
        "OPENAI_API_KEY is not configured on the server.",
        500,
        "not-configured",
      );
    }

    const payload = parseExtractionPayload(await request.json().catch(() => null));

    if (payload.sourceMode === "url" && !isValidAbsoluteHttpUrl(payload.datasheetUrl)) {
      throw new RouteError("Datasheet URL must be a valid absolute URL.", 400, "invalid-request");
    }

    const pdfSource =
      payload.sourceMode === "upload"
        ? await readUploadedPdf(payload.uploadedPdf)
        : await readPdfFromUrl(payload.datasheetUrl, request.signal);

    if ("cleanupObjectKey" in pdfSource) {
      pendingObjectKey = pdfSource.cleanupObjectKey;
    }

    if (request.signal.aborted) {
      throw new ExtractionCancelledError();
    }

    inModelStage = true;

    const extraction = await extractDatasheet({
      model: payload.model,
      packageCategory: payload.packageCategory,
      partNumber: payload.partNumber,
      pdfBytes: pdfSource.pdfBytes,
      pdfFileName: pdfSource.pdfFileName,
      reasoningEffort: payload.reasoningEffort,
      requestedFields: PACKAGE_CATEGORY_FIELDS[payload.packageCategory],
      signal: request.signal,
      sourceLabel: pdfSource.sourceLabel,
    });

    inModelStage = false;

    const extractionSnapshot = buildExtractionSnapshot(extraction);

    let submissionId: string | undefined;
    let intakeSnapshot: SubmissionIntakeSnapshot;
    let urlCacheWrite: { contentSha256: string; normalizedUrl: string } | null = null;

    if (payload.sourceMode === "upload") {
      const uploadSourceMeta = pdfSource.sourceMeta as UploadSourceMeta;

      if (request.signal.aborted) {
        throw new ExtractionCancelledError();
      }

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
      const urlSourceMeta = pdfSource.sourceMeta as UrlSourceMeta;
      const contentSha256 = createHash("sha256").update(pdfSource.pdfBytes).digest("hex");

      urlCacheWrite = {
        contentSha256,
        normalizedUrl: urlSourceMeta.normalizedUrl,
      };
      intakeSnapshot = {
        packageCategory: payload.packageCategory,
        partNumber: payload.partNumber,
        requestedFields: [...PACKAGE_CATEGORY_FIELDS[payload.packageCategory]],
        sourceLabel: pdfSource.sourceLabel,
        sourceMeta: {
          ...urlSourceMeta,
          contentSha256,
        },
        sourceMode: payload.sourceMode,
      };
    }

    // Last point of no return: a cancel that arrives after this still saves (spec copy says so).
    if (request.signal.aborted) {
      throw new ExtractionCancelledError();
    }

    const submission = await createSubmission({
      extraction: extractionSnapshot,
      intake: intakeSnapshot,
      submissionId,
    });

    permanentObjectKey = null;

    if (urlCacheWrite) {
      const { contentSha256, normalizedUrl } = urlCacheWrite;
      const pdfBytes = pdfSource.pdfBytes;

      // Write-through: keep the exact extracted revision for the viewer and re-runs.
      after(async () => {
        try {
          await cacheUrlSourcePdf({ contentSha256, normalizedUrl, pdfBytes });
        } catch (error) {
          console.warn("Could not cache the URL-source PDF.", error);
        }
      });
    }

    if (pendingObjectKey) {
      await cleanupUploadedObjects([pendingObjectKey]);
      pendingObjectKey = null;
    }

    return Response.json(submission satisfies SubmissionDetail);
  } catch (error) {
    const routeError = toRouteError(error);
    const keepPendingUpload =
      inModelStage && pendingObjectKey !== null && routeError.code !== "cancelled";

    await cleanupUploadedObjects([
      keepPendingUpload ? null : pendingObjectKey,
      permanentObjectKey,
    ]);

    return errorResponse(routeError, keepPendingUpload);
  }
}
