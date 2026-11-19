import { createHash } from "node:crypto";

import type {
  DrawingPayload,
  ExtractionErrorCode,
  UploadedPdfPayload,
} from "@/lib/extractions";
import {
  buildPdfDisplayFileName,
  looksLikePdf,
  MAX_PDF_BYTES,
  normalizePdfFileName,
  PDF_MIME_TYPE,
  PDF_UPLOAD_LIMIT_MESSAGE,
} from "@/lib/pdf";
import {
  isPdfSourceCancelled,
  PdfSourceError,
  readPdfFromUrl,
} from "@/lib/pdf-source";
import {
  buildSubmissionDrawingObjectKey,
  copyObject,
  deleteObject,
  downloadObjectBytes,
  headObject,
  isPendingPdfObjectKey,
  putObject,
  R2ConfigError,
  R2ObjectTooLargeError,
} from "@/lib/r2";
import type { DrawingSourceMeta } from "@/lib/submissions/types";

/*
 * Server-only: the optional package drawing (a second PDF) for new
 * extractions and re-runs. A drawing is always kept in R2 under the
 * submission's own prefix, whether it was uploaded or downloaded from a link,
 * so the viewer and later re-runs never go back to the vendor.
 */

const PREFIX = "Package drawing:";

/** A drawing problem, with the intake error code the routes return. */
export class DrawingSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ExtractionErrorCode,
  ) {
    super(message);
    this.name = "DrawingSourceError";
  }
}

function invalid(message: string): never {
  throw new DrawingSourceError(`${PREFIX} ${message}`, 400, "invalid-request");
}

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseUploadedPdf(value: unknown): UploadedPdfPayload {
  if (!value || typeof value !== "object") {
    invalid("the uploaded file's details are missing.");
  }

  const record = value as Record<string, unknown>;
  const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
  const objectKey = typeof record.objectKey === "string" ? record.objectKey.trim() : "";
  const sizeBytes = record.sizeBytes;

  if (record.mimeType !== PDF_MIME_TYPE) {
    throw new DrawingSourceError(`${PREFIX} the file must be a PDF.`, 400, "invalid-pdf");
  }

  if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    invalid("the file size is missing.");
  }

  if (sizeBytes > MAX_PDF_BYTES) {
    throw new DrawingSourceError(`${PREFIX} ${PDF_UPLOAD_LIMIT_MESSAGE}`, 413, "too-large");
  }

  if (!isPendingPdfObjectKey(objectKey)) {
    throw new DrawingSourceError(
      `${PREFIX} the upload is invalid. Please upload the file again.`,
      400,
      "upload-failed",
    );
  }

  return { fileName: fileName || "drawing.pdf", mimeType: PDF_MIME_TYPE, objectKey, sizeBytes };
}

/** Reads the optional `drawing` field of a request body. Null when there is none. */
export function parseDrawingPayload(value: unknown): DrawingPayload | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "object") {
    invalid("expected an upload or a link.");
  }

  const record = value as Record<string, unknown>;

  if (record.kind === "upload") {
    return { kind: "upload", uploadedPdf: parseUploadedPdf(record.uploadedPdf) };
  }

  if (record.kind === "url") {
    const url = typeof record.url === "string" ? record.url.trim() : "";

    if (!isAbsoluteHttpUrl(url)) {
      invalid("the link must be a full http or https address.");
    }

    return { kind: "url", url };
  }

  invalid("expected an upload or a link.");
}

/** A drawing read into memory, ready to send to the model and to keep. */
export type LoadedDrawing = {
  checksumSha256: string;
  fileName: string;
  pdfBytes: Uint8Array;
  /** The pending upload to copy and then delete, for an uploaded drawing. */
  pendingObjectKey: string | null;
  /** An object already kept for another submission, for a re-run that carries it. */
  sourceObjectKey: string | null;
  sourceUrl?: string;
};

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

const UNREADABLE = `${PREFIX} the upload could not be read. Please upload it again.`;

async function readUploadedDrawing(uploadedPdf: UploadedPdfPayload): Promise<LoadedDrawing> {
  let head: Awaited<ReturnType<typeof headObject>>;

  try {
    head = await headObject(uploadedPdf.objectKey);
  } catch (error) {
    if (error instanceof R2ConfigError) {
      throw error;
    }

    throw new DrawingSourceError(UNREADABLE, 400, "upload-failed");
  }

  if (!head.exists) {
    throw new DrawingSourceError(UNREADABLE, 400, "upload-failed");
  }

  if (head.contentLength === null || head.contentLength > MAX_PDF_BYTES) {
    throw new DrawingSourceError(`${PREFIX} ${PDF_UPLOAD_LIMIT_MESSAGE}`, 413, "too-large");
  }

  // The upload URL signs the declared length, so a mismatch is another file.
  if (head.contentLength !== uploadedPdf.sizeBytes) {
    throw new DrawingSourceError(UNREADABLE, 400, "upload-failed");
  }

  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await downloadObjectBytes(uploadedPdf.objectKey, MAX_PDF_BYTES);
  } catch (error) {
    if (error instanceof R2ObjectTooLargeError) {
      throw new DrawingSourceError(`${PREFIX} ${PDF_UPLOAD_LIMIT_MESSAGE}`, 413, "too-large");
    }

    throw new DrawingSourceError(UNREADABLE, 400, "upload-failed");
  }

  if (!looksLikePdf(pdfBytes)) {
    throw new DrawingSourceError(`${PREFIX} the file does not appear to be a valid PDF.`, 400, "invalid-pdf");
  }

  return {
    checksumSha256: checksum(pdfBytes),
    fileName: buildPdfDisplayFileName(uploadedPdf.fileName),
    pdfBytes,
    pendingObjectKey: uploadedPdf.objectKey,
    sourceObjectKey: null,
  };
}

async function downloadDrawing(url: string, signal?: AbortSignal): Promise<LoadedDrawing> {
  try {
    const source = await readPdfFromUrl(url, signal);

    return {
      checksumSha256: checksum(source.pdfBytes),
      fileName: source.pdfFileName,
      pdfBytes: source.pdfBytes,
      pendingObjectKey: null,
      sourceObjectKey: null,
      sourceUrl: url,
    };
  } catch (error) {
    if (isPdfSourceCancelled(error) || !(error instanceof PdfSourceError)) {
      throw error;
    }

    const code: ExtractionErrorCode =
      error.status === 413 ? "too-large" : /valid PDF/i.test(error.message) ? "invalid-pdf" : "source-unreachable";

    throw new DrawingSourceError(`${PREFIX} ${error.message}`, error.status, code);
  }
}

/** Reads a drawing from a request: the pending upload, or the link (through the guarded downloader). */
export function loadDrawing(payload: DrawingPayload, signal?: AbortSignal): Promise<LoadedDrawing> {
  return payload.kind === "upload"
    ? readUploadedDrawing(payload.uploadedPdf)
    : downloadDrawing(payload.url, signal);
}

/** Reads the drawing another submission kept, for a re-run that carries it. */
export async function loadStoredDrawing(meta: DrawingSourceMeta): Promise<LoadedDrawing> {
  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await downloadObjectBytes(meta.objectKey, MAX_PDF_BYTES);
  } catch (error) {
    if (error instanceof R2ConfigError) {
      throw error;
    }

    throw new DrawingSourceError(`${PREFIX} the saved drawing could not be read.`, 500, "unknown");
  }

  return {
    checksumSha256: meta.checksumSha256,
    fileName: meta.fileName,
    pdfBytes,
    pendingObjectKey: null,
    sourceObjectKey: meta.objectKey,
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
  };
}

/** Keeps the drawing under the submission's prefix and returns what the intake records. */
export async function storeDrawing(
  submissionId: string,
  drawing: LoadedDrawing,
): Promise<DrawingSourceMeta> {
  const objectKey = buildSubmissionDrawingObjectKey(submissionId, drawing.fileName);
  const copyFrom = drawing.pendingObjectKey ?? drawing.sourceObjectKey;

  if (copyFrom) {
    await copyObject(copyFrom, objectKey);
  } else {
    await putObject({ body: drawing.pdfBytes, contentType: PDF_MIME_TYPE, key: objectKey });
  }

  return {
    checksumSha256: drawing.checksumSha256,
    fileName: normalizePdfFileName(drawing.fileName),
    objectKey,
    sizeBytes: drawing.pdfBytes.byteLength,
    ...(drawing.sourceUrl ? { sourceUrl: drawing.sourceUrl } : {}),
  };
}

/** Best-effort delete of objects a failed or finished request no longer needs. */
export async function deleteDrawingObjects(objectKeys: Array<string | null | undefined>) {
  for (const objectKey of objectKeys) {
    if (!objectKey) {
      continue;
    }

    try {
      await deleteObject(objectKey);
    } catch {
      // The bucket's lifecycle rule clears leftover pending uploads.
    }
  }
}
