import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PDF_BYTES, PDF_UPLOAD_LIMIT_MESSAGE } from "@/lib/pdf";
import { downloadPublicUrl, PublicFetchError, type PublicDownload } from "@/lib/public-fetch";

import { isPdfSourceCancelled, PdfSourceError, readPdfFromUrl } from "./pdf-source";

vi.mock("@/lib/public-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/public-fetch")>()),
  downloadPublicUrl: vi.fn(),
}));

const download = vi.mocked(downloadPublicUrl);

const URL_INPUT = "https://vendor.example.com/datasheet.pdf";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n%%EOF");

function downloaded(bytes: Uint8Array): PublicDownload {
  return { bytes, finalUrl: new URL(URL_INPUT), headers: {}, status: 200 };
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected the promise to reject.");
}

afterEach(() => {
  download.mockReset();
});

describe("readPdfFromUrl", () => {
  it("downloads through the guarded downloader with the PDF limits", async () => {
    download.mockResolvedValue(downloaded(PDF_BYTES));

    const source = await readPdfFromUrl(`  ${URL_INPUT}  `);

    expect(source.pdfBytes).toBe(PDF_BYTES);
    expect(source.sourceLabel).toBe(URL_INPUT);
    expect(source.sourceMeta).toEqual({
      kind: "url",
      normalizedUrl: URL_INPUT,
      pdfFileName: source.pdfFileName,
    });
    expect(download).toHaveBeenCalledOnce();

    const [url, options] = download.mock.calls[0];

    expect(String(url)).toBe(URL_INPUT);
    expect(options.maxBytes).toBe(MAX_PDF_BYTES);
    expect(options.headers).toEqual({ accept: "application/pdf" });
    expect(options.prefixCheck?.length).toBe(5);
    expect(options.prefixCheck?.accept(PDF_BYTES.subarray(0, 5))).toBe(true);
    expect(options.prefixCheck?.accept(new TextEncoder().encode("<html"))).toBe(false);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects an invalid URL before downloading", async () => {
    const error = await captureError(readPdfFromUrl("ftp://vendor.example.com/a.pdf"));

    expect(error).toBeInstanceOf(PdfSourceError);
    expect((error as PdfSourceError).status).toBe(400);
    expect(download).not.toHaveBeenCalled();
  });

  it("rejects a body that is not a PDF", async () => {
    download.mockResolvedValue(downloaded(new TextEncoder().encode("<html></html>")));

    const error = (await captureError(readPdfFromUrl(URL_INPUT))) as PdfSourceError;

    expect(error.status).toBe(400);
    expect(error.message).toMatch(/valid PDF/);
  });

  it.each([
    ["too-large", 413, PDF_UPLOAD_LIMIT_MESSAGE],
    ["rejected-content", 400, "The fetched URL did not return a valid PDF."],
    ["aborted", 408, "Timed out while fetching the datasheet URL."],
    ["invalid-url", 400, "Datasheet URL must be a valid absolute URL."],
    ["blocked", 400, "Could not fetch the PDF URL."],
    ["unreachable", 400, "Could not fetch the PDF URL."],
    ["http-status", 400, "Could not fetch the PDF URL."],
    ["too-many-redirects", 400, "Could not fetch the PDF URL."],
  ] as const)("maps a %s download failure to %i", async (reason, status, message) => {
    download.mockRejectedValue(new PublicFetchError(reason));

    const error = (await captureError(readPdfFromUrl(URL_INPUT))) as PdfSourceError;

    expect(error).toBeInstanceOf(PdfSourceError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
  });
});

describe("readPdfFromUrl cancellation", () => {
  it("does not download when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await captureError(readPdfFromUrl(URL_INPUT, controller.signal));

    expect(isPdfSourceCancelled(error)).toBe(true);
    expect(download).not.toHaveBeenCalled();
  });

  it("reports a cancel during the download as cancelled, not a timeout", async () => {
    const controller = new AbortController();

    download.mockImplementation(async () => {
      controller.abort();
      throw new PublicFetchError("aborted");
    });

    const error = await captureError(readPdfFromUrl(URL_INPUT, controller.signal));

    expect(isPdfSourceCancelled(error)).toBe(true);
  });

  it("passes the caller's signal through to the download", async () => {
    const controller = new AbortController();

    download.mockImplementation(async (_url, options) => {
      expect(options.signal?.aborted).toBe(false);
      controller.abort();
      expect(options.signal?.aborted).toBe(true);
      throw new PublicFetchError("aborted");
    });

    await captureError(readPdfFromUrl(URL_INPUT, controller.signal));

    expect(download).toHaveBeenCalledOnce();
  });
});

describe("isPdfSourceCancelled", () => {
  it("is false for other failures", () => {
    expect(isPdfSourceCancelled(new PdfSourceError("Could not fetch the PDF URL.", 400))).toBe(
      false,
    );
    expect(isPdfSourceCancelled(new Error("boom"))).toBe(false);
    expect(isPdfSourceCancelled(null)).toBe(false);
  });
});
