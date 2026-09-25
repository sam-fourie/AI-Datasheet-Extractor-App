import {
  cacheUrlSourcePdf,
  findCachedUrlSourcePdf,
  sha256Hex,
} from "@/lib/pdf-cache";
import { isPdfSourceCancelled, PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";
import {
  createObjectAttachmentUrl,
  createObjectViewerUrl,
  type SignedObjectUrl,
} from "@/lib/r2";
import { hasRetainedUploadSource } from "@/lib/submissions/source";
import type {
  PdfViewerState,
  SubmissionIntakeSnapshot,
  UrlSourceMeta,
} from "@/lib/submissions/types";

/*
 * Server-only: resolves where the review page's PDF pane (and the GET /pdf
 * redirect) can read a submission's datasheet. Imports the R2 client.
 */

export type PdfViewerSubmission = {
  intake: Pick<SubmissionIntakeSnapshot, "sourceMeta">;
  submissionId: string;
};

export type PdfViewerReady = Extract<PdfViewerState, { status: "ready" }>;
export type PdfViewerUnavailable = Extract<PdfViewerState, { status: "unavailable" }>;

export type PdfViewerError = {
  code: "source-unreachable";
  message: string;
  originalUrl: string;
  status: "error";
};

/** POST /pdf/viewer body for failures that are not a viewer state (bad id, config, unexpected). */
export type PdfViewerRouteError = {
  code: "invalid-request" | "not-configured" | "not-found" | "unknown";
  error: string;
  status: "error";
};

/** Result of `ensurePdfViewerReady`: never `uncached`. Also the POST /pdf/viewer body. */
export type EnsuredPdfViewerState = PdfViewerReady | PdfViewerUnavailable | PdfViewerError;

/** A readable R2 object for the submission's PDF, before signing. */
type PdfObjectLocation = {
  cachedAt: string | null;
  fileName: string;
  objectKey: string;
  revision: PdfViewerReady["revision"];
  sizeBytes: number | null;
  source: PdfViewerReady["source"];
};

type PdfObjectResolution =
  | { location: PdfObjectLocation; status: "found" }
  | { fileName: string; originalUrl: string; status: "uncached" }
  | PdfViewerUnavailable
  | PdfViewerError;

async function findUrlSourceObject(
  sourceMeta: UrlSourceMeta,
): Promise<PdfObjectLocation | null> {
  const fileName = sourceMeta.pdfFileName;

  if (sourceMeta.contentSha256) {
    const exact = await findCachedUrlSourcePdf(
      sourceMeta.normalizedUrl,
      sourceMeta.contentSha256,
    );

    if (exact) {
      return {
        cachedAt: exact.cachedAt,
        fileName,
        objectKey: exact.objectKey,
        revision: "extracted",
        sizeBytes: exact.sizeBytes,
        source: "url-cache",
      };
    }
  }

  const latest = await findCachedUrlSourcePdf(sourceMeta.normalizedUrl, null);

  if (!latest) {
    return null;
  }

  return {
    cachedAt: latest.cachedAt,
    fileName,
    objectKey: latest.objectKey,
    revision: "latest-copy",
    sizeBytes: latest.sizeBytes,
    source: "url-cache",
  };
}

/**
 * Fetches the vendor copy and caches it. When the bytes match the extracted
 * revision they go under the content key; otherwise under the legacy key as a
 * "latest copy".
 */
async function fetchAndCacheUrlSource(
  sourceMeta: UrlSourceMeta,
  signal: AbortSignal | undefined,
): Promise<PdfObjectLocation | PdfViewerError> {
  let pdfBytes: Uint8Array;

  try {
    ({ pdfBytes } = await readPdfFromUrl(sourceMeta.normalizedUrl, signal));
  } catch (error) {
    // The caller went away: nothing to report, and nothing is cached.
    if (isPdfSourceCancelled(error)) {
      throw error;
    }

    if (error instanceof PdfSourceError) {
      return {
        code: "source-unreachable",
        message: error.message,
        originalUrl: sourceMeta.normalizedUrl,
        status: "error",
      };
    }

    throw error;
  }

  const digest = sha256Hex(pdfBytes);
  const isExtractedRevision =
    Boolean(sourceMeta.contentSha256) && sourceMeta.contentSha256 === digest;
  const written = await cacheUrlSourcePdf({
    contentSha256: isExtractedRevision ? digest : null,
    normalizedUrl: sourceMeta.normalizedUrl,
    pdfBytes,
  });

  return {
    cachedAt: written.cachedAt,
    fileName: sourceMeta.pdfFileName,
    objectKey: written.objectKey,
    revision: isExtractedRevision ? "extracted" : "latest-copy",
    sizeBytes: written.sizeBytes,
    source: "url-cache",
  };
}

async function resolvePdfObject(
  submission: PdfViewerSubmission,
  options: { fetchWhenUncached: boolean; signal?: AbortSignal },
): Promise<PdfObjectResolution> {
  const sourceMeta = submission.intake.sourceMeta;

  if (sourceMeta.kind === "upload") {
    if (!hasRetainedUploadSource(sourceMeta)) {
      return { reason: "not-retained", status: "unavailable" };
    }

    return {
      location: {
        cachedAt: null,
        fileName: sourceMeta.fileName,
        objectKey: sourceMeta.objectKey,
        revision: "extracted",
        sizeBytes: typeof sourceMeta.sizeBytes === "number" ? sourceMeta.sizeBytes : null,
        source: "upload",
      },
      status: "found",
    };
  }

  const cached = await findUrlSourceObject(sourceMeta);

  if (cached) {
    return { location: cached, status: "found" };
  }

  if (!options.fetchWhenUncached) {
    return {
      fileName: sourceMeta.pdfFileName,
      originalUrl: sourceMeta.normalizedUrl,
      status: "uncached",
    };
  }

  const fetched = await fetchAndCacheUrlSource(sourceMeta, options.signal);

  return "status" in fetched ? fetched : { location: fetched, status: "found" };
}

function toReadyState(location: PdfObjectLocation, signed: SignedObjectUrl): PdfViewerReady {
  return {
    cachedAt: location.cachedAt,
    expiresAt: signed.expiresAt,
    fileName: location.fileName,
    revision: location.revision,
    sizeBytes: location.sizeBytes,
    source: location.source,
    status: "ready",
    url: signed.url,
  };
}

/**
 * Viewer state for the review page. Never fetches from vendors: an uncached
 * URL source returns `uncached`, and the client calls POST /pdf/viewer.
 */
export async function resolvePdfViewer(
  submission: PdfViewerSubmission,
): Promise<PdfViewerState> {
  const resolution = await resolvePdfObject(submission, { fetchWhenUncached: false });

  switch (resolution.status) {
    case "found":
      return toReadyState(
        resolution.location,
        await createObjectViewerUrl(resolution.location.objectKey, resolution.location.fileName),
      );
    case "uncached":
      return resolution;
    case "unavailable":
      return resolution;
    case "error":
      // Unreachable without a vendor fetch; treat as uncached so the client can retry.
      return {
        fileName: (submission.intake.sourceMeta as UrlSourceMeta).pdfFileName,
        originalUrl: resolution.originalUrl,
        status: "uncached",
      };
  }
}

/**
 * Like `resolvePdfViewer`, but lazily fetches and caches an uncached URL
 * source. Used by POST /pdf/viewer and GET /pdf. `signal` (the route's
 * `request.signal`) stops the vendor download when the client goes away; the
 * PdfSourceError it then throws satisfies `isPdfSourceCancelled`.
 */
export async function ensurePdfViewerReady(
  submission: PdfViewerSubmission,
  options: { download?: boolean; signal?: AbortSignal } = {},
): Promise<EnsuredPdfViewerState> {
  const resolution = await resolvePdfObject(submission, {
    fetchWhenUncached: true,
    signal: options.signal,
  });

  if (resolution.status !== "found") {
    if (resolution.status === "uncached") {
      // resolvePdfObject never returns uncached when fetching is allowed.
      throw new Error("PDF could not be cached.");
    }

    return resolution;
  }

  const { location } = resolution;
  const signed = options.download
    ? await createObjectAttachmentUrl(location.objectKey, location.fileName)
    : await createObjectViewerUrl(location.objectKey, location.fileName);

  return toReadyState(location, signed);
}
