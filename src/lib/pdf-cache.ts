import { createHash } from "node:crypto";

import { looksLikePdf, PDF_MIME_TYPE } from "@/lib/pdf";
import { getObject, headObject, putObject } from "@/lib/r2";

/**
 * Content-addressed R2 cache for URL-sourced datasheets (addendum F).
 *
 * - `datasheets/url-cache/{sha256(normalizedUrl)}/{contentSha256}.pdf` holds the
 *   exact bytes that were extracted (submissions with `contentSha256`).
 * - `datasheets/url-cache/{sha256(normalizedUrl)}/legacy.pdf` holds a copy fetched
 *   later from the vendor for legacy submissions without `contentSha256`.
 *
 * Objects are shared by every submission of the same URL, so nothing in the app
 * ever deletes them. Server-only: imports the R2 client.
 */

export const URL_CACHE_PREFIX = "datasheets/url-cache";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function sha256Hex(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Returns the digest when it is a well-formed lower-case sha256 hex string, otherwise null. */
function toContentDigest(contentSha256: string | null | undefined) {
  const value = contentSha256?.trim().toLowerCase();

  return value && SHA256_HEX_PATTERN.test(value) ? value : null;
}

export function buildUrlCacheObjectKey(
  normalizedUrl: string,
  contentSha256: string | null | undefined,
) {
  const urlDigest = sha256Hex(normalizedUrl.trim());
  const contentDigest = toContentDigest(contentSha256);

  return `${URL_CACHE_PREFIX}/${urlDigest}/${contentDigest ?? "legacy"}.pdf`;
}

export function isUrlCacheObjectKey(objectKey: string) {
  return objectKey.startsWith(`${URL_CACHE_PREFIX}/`);
}

export type UrlCacheWriteResult = {
  cachedAt: string;
  created: boolean;
  objectKey: string;
  sizeBytes: number | null;
};

/**
 * Writes the PDF under its content key (or the legacy key when `contentSha256`
 * is null), skipping the Put when HEAD finds the object already cached.
 */
export async function cacheUrlSourcePdf(input: {
  contentSha256: string | null;
  normalizedUrl: string;
  pdfBytes: Uint8Array;
}): Promise<UrlCacheWriteResult> {
  const objectKey = buildUrlCacheObjectKey(input.normalizedUrl, input.contentSha256);
  const existing = await headObject(objectKey);

  if (existing.exists) {
    return {
      cachedAt: readCachedAt(existing.metadata, existing.lastModified),
      created: false,
      objectKey,
      sizeBytes: existing.contentLength,
    };
  }

  const cachedAt = new Date().toISOString();

  await putObject({
    body: input.pdfBytes,
    contentType: PDF_MIME_TYPE,
    key: objectKey,
    metadata: {
      "cached-at": cachedAt,
      sha256: sha256Hex(input.pdfBytes),
      "source-url": encodeURIComponent(input.normalizedUrl.trim()),
    },
  });

  return { cachedAt, created: true, objectKey, sizeBytes: input.pdfBytes.byteLength };
}

export type CachedUrlSourcePdf = {
  bytes: Uint8Array;
  cachedAt: string | null;
  objectKey: string;
};

/**
 * Reads a cached copy. Content keys are verified against their digest, so a
 * corrupt object reads as a miss rather than as the wrong revision.
 */
export async function readCachedUrlSourcePdf(
  normalizedUrl: string,
  contentSha256: string | null,
): Promise<CachedUrlSourcePdf | null> {
  const objectKey = buildUrlCacheObjectKey(normalizedUrl, contentSha256);
  const object = await getObject(objectKey);

  if (!object || !looksLikePdf(object.bytes)) {
    return null;
  }

  const contentDigest = toContentDigest(contentSha256);

  if (contentDigest && sha256Hex(object.bytes) !== contentDigest) {
    return null;
  }

  return {
    bytes: object.bytes,
    cachedAt: readCachedAt(object.metadata, object.lastModified),
    objectKey,
  };
}

export type UrlCacheEntry = {
  cachedAt: string | null;
  objectKey: string;
  sizeBytes: number | null;
};

/** HEAD lookup of one cache key, without downloading the bytes. */
export async function findCachedUrlSourcePdf(
  normalizedUrl: string,
  contentSha256: string | null,
): Promise<UrlCacheEntry | null> {
  const objectKey = buildUrlCacheObjectKey(normalizedUrl, contentSha256);
  const head = await headObject(objectKey);

  if (!head.exists) {
    return null;
  }

  return {
    cachedAt: readCachedAt(head.metadata, head.lastModified),
    objectKey,
    sizeBytes: head.contentLength,
  };
}

function readCachedAt(metadata: Record<string, string>, lastModified: string | null) {
  const value = metadata["cached-at"];

  if (value && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return lastModified ?? new Date().toISOString();
}
