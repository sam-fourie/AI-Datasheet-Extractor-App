import {
  buildPdfFileNameFromUrl,
  looksLikePdf,
  MAX_PDF_BYTES,
} from "@/lib/pdf";
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

function ensurePdfSize(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfSourceError("PDF exceeds the 20 MB upload limit for v1.", 413);
  }
}

function parsePdfUrl(datasheetUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(datasheetUrl);
  } catch {
    throw new PdfSourceError("Datasheet URL must be a valid absolute URL.", 400);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new PdfSourceError("Datasheet URL must be a valid absolute URL.", 400);
  }

  return parsedUrl;
}

export async function readPdfFromUrl(datasheetUrl: string): Promise<PdfSource> {
  const trimmedUrl = datasheetUrl.trim();

  if (trimmedUrl.length === 0) {
    throw new PdfSourceError("Missing required field: datasheetUrl.", 400);
  }

  const parsedUrl = parsePdfUrl(trimmedUrl);

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        accept: "application/pdf",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new PdfSourceError("Could not fetch the PDF URL.", 400);
    }

    const pdfBytes = new Uint8Array(await response.arrayBuffer());

    ensurePdfSize(pdfBytes);

    if (!looksLikePdf(pdfBytes)) {
      throw new PdfSourceError("The fetched URL did not return a valid PDF.", 400);
    }

    return {
      pdfBytes,
      pdfFileName: buildPdfFileNameFromUrl(parsedUrl),
      sourceLabel: trimmedUrl,
      sourceMeta: {
        kind: "url",
        normalizedUrl: trimmedUrl,
        pdfFileName: buildPdfFileNameFromUrl(parsedUrl),
      },
    };
  } catch (error) {
    if (error instanceof PdfSourceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new PdfSourceError("Timed out while fetching the datasheet URL.", 408);
    }

    throw new PdfSourceError("Could not fetch the PDF URL.", 400);
  }
}
