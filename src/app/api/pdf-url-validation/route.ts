import { PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { datasheetUrl?: unknown }
      | null;

    await readPdfFromUrl(getDatasheetUrl(payload));

    return Response.json({
      ok: true,
    });
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
