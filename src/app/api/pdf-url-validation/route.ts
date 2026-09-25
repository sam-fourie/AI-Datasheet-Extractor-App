import { requireAuthorizedRequest } from "@/app/api/_lib/access";
import type {
  PdfUrlValidationErrorCode,
  PdfUrlValidationResponse,
} from "@/lib/extractions";
import { PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";
import { getUrlHost } from "@/lib/submissions/source";

export const runtime = "nodejs";
export const maxDuration = 300;

function getDatasheetUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new PdfSourceError("Missing required field: datasheetUrl.", 400);
  }

  const datasheetUrl = (payload as { datasheetUrl?: unknown }).datasheetUrl;

  if (typeof datasheetUrl !== "string" || datasheetUrl.trim().length === 0) {
    throw new PdfSourceError("Missing required field: datasheetUrl.", 400);
  }

  return datasheetUrl.trim();
}

function toRouteError(error: unknown) {
  if (error instanceof PdfSourceError) {
    return error;
  }

  if (error instanceof Error) {
    return new PdfSourceError(error.message, 500);
  }

  return new PdfSourceError("Unexpected PDF URL validation error.", 500);
}

function toErrorCode(error: PdfSourceError): PdfUrlValidationErrorCode {
  if (error.status >= 500) {
    return "unknown";
  }

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

export async function POST(request: Request) {
  const unauthorized = requireAuthorizedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { datasheetUrl?: unknown }
      | null;
    const datasheetUrl = getDatasheetUrl(payload);
    // Abandoned validations (the intake aborts on every URL change) stop downloading.
    const source = await readPdfFromUrl(datasheetUrl, request.signal);

    return Response.json({
      fileName: source.pdfFileName,
      host: getUrlHost(source.sourceMeta.normalizedUrl) ?? "",
      ok: true,
      sizeBytes: source.pdfBytes.byteLength,
    } satisfies PdfUrlValidationResponse);
  } catch (error) {
    const routeError = toRouteError(error);

    return Response.json(
      {
        code: toErrorCode(routeError),
        error: routeError.message,
      } satisfies PdfUrlValidationResponse,
      {
        status: routeError.status,
      },
    );
  }
}
