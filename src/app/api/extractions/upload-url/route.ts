import { requireAuthorizedRequest } from "@/app/api/_lib/access";
import type {
  ExtractionErrorCode,
  ExtractionErrorResponse,
  UploadUrlRequestPayload,
  UploadUrlResponse,
} from "@/lib/extractions";
import {
  MAX_PDF_BYTES,
  PDF_MIME_TYPE,
  PDF_UPLOAD_LIMIT_MESSAGE,
} from "@/lib/pdf";
import {
  createPdfUploadUrl,
  R2ConfigError,
} from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Machine-readable failure reasons this route returns alongside `error`. */
type UploadUrlErrorCode = Extract<
  ExtractionErrorCode,
  "invalid-request" | "not-configured" | "too-large" | "upload-failed"
>;

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: UploadUrlErrorCode,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

function getObjectValue(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new RouteError(
      "Upload request payload must be a JSON object.",
      400,
      "invalid-request",
    );
  }

  return value as Record<string, unknown>;
}

function getOptionalFileName(value: unknown) {
  if (typeof value !== "string") {
    return "datasheet.pdf";
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : "datasheet.pdf";
}

function parsePayload(payload: unknown): UploadUrlRequestPayload {
  const value = getObjectValue(payload);
  const mimeType =
    typeof value.mimeType === "string" ? value.mimeType.trim() : null;
  const sizeBytes = value.sizeBytes;

  if (mimeType !== PDF_MIME_TYPE) {
    throw new RouteError("Uploaded file must be a PDF.", 400, "invalid-request");
  }

  // An integer: it is signed into the upload URL as the exact Content-Length.
  if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new RouteError("Missing required field: sizeBytes.", 400, "invalid-request");
  }

  if (sizeBytes > MAX_PDF_BYTES) {
    throw new RouteError(PDF_UPLOAD_LIMIT_MESSAGE, 413, "too-large");
  }

  return {
    fileName: getOptionalFileName(value.fileName),
    mimeType,
    sizeBytes,
  };
}

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof R2ConfigError) {
    return new RouteError(error.message, 500, "not-configured");
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500, "upload-failed");
  }

  return new RouteError("Unexpected upload URL error.", 500, "upload-failed");
}

export async function POST(request: Request) {
  const unauthorized = requireAuthorizedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = parsePayload(await request.json().catch(() => null));
    const uploadUrl = await createPdfUploadUrl(payload.fileName, payload.sizeBytes);

    return Response.json(uploadUrl satisfies UploadUrlResponse);
  } catch (error) {
    const routeError = toRouteError(error);

    return Response.json(
      {
        code: routeError.code,
        error: routeError.message,
      } satisfies ExtractionErrorResponse,
      {
        status: routeError.status,
      },
    );
  }
}
