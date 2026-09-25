import { buildPdfDisplayFileName, buildPdfFileNameFromUrl } from "@/lib/pdf";
import type {
  SubmissionSourceMeta,
  SubmissionSourceSummary,
} from "@/lib/submissions/types";

/*
 * Client-safe helpers for a submission's PDF source. Imported by client
 * components, so keep this file free of server-only imports.
 */

export function hasRetainedUploadSource(
  sourceMeta: SubmissionSourceMeta,
): sourceMeta is Extract<SubmissionSourceMeta, { kind: "upload" }> & {
  objectKey: string;
  storageProvider: "cloudflare-r2";
} {
  return (
    sourceMeta.kind === "upload" &&
    sourceMeta.storageProvider === "cloudflare-r2" &&
    typeof sourceMeta.objectKey === "string" &&
    sourceMeta.objectKey.length > 0
  );
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** URL host without a leading "www.", or null when the URL cannot be parsed. */
export function getUrlHost(value: string) {
  const url = parseUrl(value.trim());

  return url ? url.hostname.replace(/^www\./i, "") : null;
}

/**
 * Match key for part numbers: lower-case alphanumerics only, so "NE555DR",
 * "ne555-dr" and "NE555 DR" collide. Used for duplicate detection.
 */
export function normalizePartNumberKey(partNumber: string) {
  return partNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function describeSubmissionSource(
  sourceMeta: SubmissionSourceMeta,
): SubmissionSourceSummary {
  if (sourceMeta.kind === "upload") {
    const fileName = buildPdfDisplayFileName(sourceMeta.fileName);

    return {
      fileName,
      host: null,
      kind: "upload",
      label: fileName,
      originalUrl: null,
      sizeBytes: typeof sourceMeta.sizeBytes === "number" ? sourceMeta.sizeBytes : null,
    };
  }

  const originalUrl = sourceMeta.normalizedUrl.trim();
  const url = parseUrl(originalUrl);
  const host = url ? url.hostname.replace(/^www\./i, "") : null;
  const fileName =
    sourceMeta.pdfFileName?.trim() ||
    (url ? buildPdfFileNameFromUrl(url) : buildPdfDisplayFileName(null));

  return {
    fileName,
    host,
    kind: "url",
    label: host ? `${host} · ${fileName}` : fileName,
    originalUrl,
    sizeBytes: null,
  };
}

function toPageNumber(page: number | null | undefined) {
  return typeof page === "number" && Number.isInteger(page) && page > 0 ? page : null;
}

export type SubmissionPdfHref = {
  /** Whether the app can show this PDF (retained upload or URL source). */
  available: boolean;
  /** The vendor URL for URL sources (with `#page=N` when a page is given), otherwise null. */
  external: string | null;
  /** Internal route that 307s to a signed copy: `/api/submissions/{id}/pdf?page=N`. */
  href: string | null;
};

/**
 * Where to open a submission's PDF. URL sources are served through the R2
 * cache route (which caches lazily on first view); non-retained uploads have
 * no copy at all.
 */
export function getSubmissionPdfHref(
  submissionId: string,
  sourceMeta: SubmissionSourceMeta,
  page?: number | null,
): SubmissionPdfHref {
  const pageNumber = toPageNumber(page);
  const query = pageNumber ? `?page=${pageNumber}` : "";
  const href = `/api/submissions/${encodeURIComponent(submissionId)}/pdf${query}`;

  if (sourceMeta.kind === "url") {
    const originalUrl = sourceMeta.normalizedUrl.trim();
    const external = originalUrl
      ? `${originalUrl.split("#")[0]}${pageNumber ? `#page=${pageNumber}` : ""}`
      : null;

    return { available: true, external, href };
  }

  if (!hasRetainedUploadSource(sourceMeta)) {
    return { available: false, external: null, href: null };
  }

  return { available: true, external: null, href };
}
