import type {
  UploadUrlRequestPayload,
  UploadUrlResponse,
} from "@/lib/extractions";
import {
  MAX_PDF_BYTES,
  PDF_MIME_TYPE,
} from "@/lib/pdf";
import {
  createPdfUploadUrl,
  R2ConfigError,
} from "@/lib/r2";

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

function getObjectValue(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new RouteError("Upload request payload must be a JSON object.", 400);
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
    throw new RouteError("Uploaded file must be a PDF.", 400);
  }

  if (!Number.isFinite(sizeBytes) || typeof sizeBytes !== "number" || sizeBytes <= 0) {
    throw new RouteError("Missing required field: sizeBytes.", 400);
  }

  if (sizeBytes > MAX_PDF_BYTES) {
    throw new RouteError("PDF exceeds the 20 MB upload limit for v1.", 413);
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
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected upload URL error.", 500);
}

export async function POST(request: Request) {
  try {
    const payload = parsePayload(await request.json().catch(() => null));
    const uploadUrl = await createPdfUploadUrl(payload.fileName);

    return Response.json(uploadUrl satisfies UploadUrlResponse);
  } catch (error) {
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
