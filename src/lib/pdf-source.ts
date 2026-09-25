import {
  buildPdfFileNameFromUrl,
  looksLikePdf,
  MAX_PDF_BYTES,
  PDF_UPLOAD_LIMIT_MESSAGE,
} from "@/lib/pdf";
import { downloadPublicUrl, PublicFetchError } from "@/lib/public-fetch";
import type { UrlSourceMeta } from "@/lib/submissions/types";

export type PdfSource = {
  pdfBytes: Uint8Array;
  pdfFileName: string;
  sourceLabel: string;
  sourceMeta: UrlSourceMeta;
};

export class PdfSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfSourceError";
  }
}

const FETCH_FAILED_MESSAGE = "Could not fetch the PDF URL.";
const INVALID_PDF_MESSAGE = "The fetched URL did not return a valid PDF.";
const INVALID_URL_MESSAGE = "Datasheet URL must be a valid absolute URL.";

/** "%PDF-": enough for the downloader to drop a non-PDF body early. */
const PDF_SIGNATURE_LENGTH = 5;

function ensurePdfSize(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfSourceError(PDF_UPLOAD_LIMIT_MESSAGE, 413);
  }
}

function parsePdfUrl(datasheetUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(datasheetUrl);
  } catch {
    throw new PdfSourceError(INVALID_URL_MESSAGE, 400);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new PdfSourceError(INVALID_URL_MESSAGE, 400);
  }

  return parsedUrl;
}

const FETCH_TIMEOUT_MS = 30_000;

/** Status used when the caller aborted (client closed request); never meant to be read. */
const CANCELLED_STATUS = 499;

/** True when `readPdfFromUrl` stopped because the caller's `signal` aborted. */
export function isPdfSourceCancelled(error: unknown): error is PdfSourceError {
  return error instanceof PdfSourceError && error.status === CANCELLED_STATUS;
}

/**
 * Maps a guarded-download failure to the route-facing error. Blocked hosts,
 * unreachable hosts, bad statuses and redirect loops share one message, so
 * the response never reveals which internal addresses exist or answer.
 */
function toPdfSourceError(
  error: unknown,
  signal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): PdfSourceError {
  if (error instanceof PdfSourceError) {
    return error;
  }

  if (signal?.aborted) {
    return new PdfSourceError("The request was cancelled.", CANCELLED_STATUS);
  }

  if (!(error instanceof PublicFetchError)) {
    return timeoutSignal.aborted
      ? new PdfSourceError("Timed out while fetching the datasheet URL.", 408)
      : new PdfSourceError(FETCH_FAILED_MESSAGE, 400);
  }

  switch (error.reason) {
    case "too-large":
      return new PdfSourceError(PDF_UPLOAD_LIMIT_MESSAGE, 413);
    case "rejected-content":
      return new PdfSourceError(INVALID_PDF_MESSAGE, 400);
    case "aborted":
      return new PdfSourceError("Timed out while fetching the datasheet URL.", 408);
    case "invalid-url":
      return new PdfSourceError(INVALID_URL_MESSAGE, 400);
    default:
      return new PdfSourceError(FETCH_FAILED_MESSAGE, 400);
  }
}

/**
 * Downloads and checks a PDF from a vendor URL through the guarded public
 * downloader (no private or internal hosts, each redirect re-checked, the
 * body capped at MAX_PDF_BYTES while streaming, non-PDF bodies dropped after
 * their first bytes). The download stops after 30 s, or as soon as `signal`
 * aborts, e.g. a route passing `request.signal` so an abandoned request stops
 * downloading.
 */
export async function readPdfFromUrl(
  datasheetUrl: string,
  signal?: AbortSignal,
): Promise<PdfSource> {
  const trimmedUrl = datasheetUrl.trim();

  if (trimmedUrl.length === 0) {
    throw new PdfSourceError("Missing required field: datasheetUrl.", 400);
  }

  const parsedUrl = parsePdfUrl(trimmedUrl);

  if (signal?.aborted) {
    throw new PdfSourceError("The request was cancelled.", CANCELLED_STATUS);
  }

  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let pdfBytes: Uint8Array;

  try {
    ({ bytes: pdfBytes } = await downloadPublicUrl(parsedUrl, {
      headers: { accept: "application/pdf" },
      maxBytes: MAX_PDF_BYTES,
      prefixCheck: { accept: looksLikePdf, length: PDF_SIGNATURE_LENGTH },
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    }));
  } catch (error) {
    throw toPdfSourceError(error, signal, timeoutSignal);
  }

  // The authoritative checks; the download already enforced both while streaming.
  ensurePdfSize(pdfBytes);

  if (!looksLikePdf(pdfBytes)) {
    throw new PdfSourceError(INVALID_PDF_MESSAGE, 400);
  }

  // Named after the URL the reviewer entered, not a redirect target (often a
  // CDN path with an opaque name).
  const pdfFileName = buildPdfFileNameFromUrl(parsedUrl);

  return {
    pdfBytes,
    pdfFileName,
    sourceLabel: trimmedUrl,
    sourceMeta: {
      kind: "url",
      normalizedUrl: trimmedUrl,
      pdfFileName,
    },
  };
}
