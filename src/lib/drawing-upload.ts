import type {
  DrawingPayload,
  ExtractionErrorResponse,
  UploadUrlRequestPayload,
  UploadUrlResponse,
} from "@/lib/extractions";
import { MAX_PDF_BYTES, PDF_MIME_TYPE, PDF_UPLOAD_LIMIT_MESSAGE } from "@/lib/pdf";

/*
 * Client-safe: turns the package drawing someone picked (a file or a link)
 * into the `drawing` field of POST /api/extractions or POST /rerun. A file is
 * uploaded straight to R2 the same way as the datasheet.
 */

/** What the drawing field holds before it is sent. */
export type DrawingInput = { file: File; kind: "upload" } | { kind: "url"; url: string };

/** Why a drawing can't be sent as picked, or null when it can. */
export function validateDrawingInput(input: DrawingInput): string | null {
  if (input.kind === "url") {
    try {
      const url = new URL(input.url.trim());

      return url.protocol === "http:" || url.protocol === "https:"
        ? null
        : "Enter a link that starts with http or https.";
    } catch {
      return "Enter the full link to the drawing PDF.";
    }
  }

  if (input.file.type && input.file.type !== PDF_MIME_TYPE && !/\.pdf$/i.test(input.file.name)) {
    return "The drawing must be a PDF.";
  }

  if (input.file.size > MAX_PDF_BYTES) {
    return PDF_UPLOAD_LIMIT_MESSAGE;
  }

  return null;
}

async function uploadDrawingFile(file: File, signal: AbortSignal): Promise<DrawingPayload> {
  const prepared = await fetch("/api/extractions/upload-url", {
    body: JSON.stringify({
      fileName: file.name,
      mimeType: PDF_MIME_TYPE,
      sizeBytes: file.size,
    } satisfies UploadUrlRequestPayload),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });
  const upload = (await prepared.json().catch(() => null)) as
    | UploadUrlResponse
    | Partial<ExtractionErrorResponse>
    | null;

  if (!prepared.ok || !upload || !("uploadUrl" in upload)) {
    const message = upload && "error" in upload && upload.error ? upload.error : "Could not prepare the upload.";

    throw new Error(`Package drawing: ${message}`);
  }

  const stored = await fetch(upload.uploadUrl, {
    body: file,
    headers: upload.requiredHeaders,
    method: "PUT",
    signal,
  });

  if (!stored.ok) {
    throw new Error(`Package drawing: storage rejected the upload (HTTP ${stored.status}).`);
  }

  return {
    kind: "upload",
    uploadedPdf: {
      fileName: file.name,
      mimeType: PDF_MIME_TYPE,
      objectKey: upload.objectKey,
      sizeBytes: file.size,
    },
  };
}

/** Uploads a picked file, or passes a link through. Abort errors are left for the caller. */
export function prepareDrawingPayload(input: DrawingInput, signal: AbortSignal): Promise<DrawingPayload> {
  return input.kind === "upload"
    ? uploadDrawingFile(input.file, signal)
    : Promise.resolve({ kind: "url", url: input.url.trim() });
}
