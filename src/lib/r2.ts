import { randomUUID } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  MAX_PDF_BYTES,
  PDF_MIME_TYPE,
  normalizePdfFileName,
} from "@/lib/pdf";
import { collectBytesWithLimit, PublicFetchError } from "@/lib/public-fetch";

const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
/** Viewer URLs are signed at the start of the UTC hour and live for two hours (addendum G). */
const VIEWER_URL_TTL_SECONDS = 2 * 60 * 60;
const VIEWER_URL_SIGNING_WINDOW_MS = 60 * 60 * 1000;
const VIEWER_CACHE_CONTROL = "private, max-age=3600";
const ATTACHMENT_URL_TTL_SECONDS = 5 * 60;

const PENDING_OBJECT_PREFIX = "datasheets/pending";
const SUBMISSION_OBJECT_PREFIX = "datasheets/submissions";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  secretAccessKey: string;
};

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

export class R2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigError";
  }
}

/** An object body passed the byte limit while it was being read. */
export class R2ObjectTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`The stored object is larger than ${maxBytes} bytes.`);
    this.name = "R2ObjectTooLargeError";
  }
}

function getRequiredEnv(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new R2ConfigError(`${name} is not configured on the server.`);
  }

  return value;
}

function getR2Config(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    accountId: getRequiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
    bucketName: getRequiredEnv("R2_BUCKET_NAME"),
    secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
  };

  return cachedConfig;
}

function getR2Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getR2Config();

  cachedClient = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
  });

  return cachedClient;
}

function toUint8Array(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }

  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }

  throw new Error("Received an unsupported R2 object chunk.");
}

async function* toByteChunks(body: AsyncIterable<unknown>) {
  for await (const chunk of body) {
    yield toUint8Array(chunk);
  }
}

/**
 * Reads an object body, stopping (and destroying the stream) as soon as it
 * passes `maxBytes`, so an oversized object is never buffered whole.
 */
async function readBodyAsBytes(body: AsyncIterable<unknown>, maxBytes: number) {
  try {
    return await collectBytesWithLimit(toByteChunks(body), maxBytes, {
      onLimit: () => (body as { destroy?: () => void }).destroy?.(),
    });
  } catch (error) {
    if (error instanceof PublicFetchError && error.reason === "too-large") {
      throw new R2ObjectTooLargeError(maxBytes);
    }

    throw error;
  }
}

function buildCopySource(bucketName: string, objectKey: string) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");

  return `${bucketName}/${encodedKey}`;
}

export function buildPendingPdfObjectKey(fileName: string) {
  return `${PENDING_OBJECT_PREFIX}/${randomUUID()}/${normalizePdfFileName(fileName)}`;
}

export function buildSubmissionPdfObjectKey(submissionId: string, fileName: string) {
  return `${SUBMISSION_OBJECT_PREFIX}/${submissionId}/${normalizePdfFileName(fileName)}`;
}

export function getR2BucketName() {
  return getR2Config().bucketName;
}

export function isPendingPdfObjectKey(objectKey: string) {
  return objectKey.startsWith(`${PENDING_OBJECT_PREFIX}/`);
}

/**
 * Presigned PUT for a browser upload. The content type and the exact length
 * the client declared are part of the signature, so the URL cannot be used to
 * store a different size or type. The browser sets Content-Length from the
 * file itself; only Content-Type has to be sent explicitly.
 */
export async function createPdfUploadUrl(fileName: string, sizeBytes: number) {
  const objectKey = buildPendingPdfObjectKey(fileName);
  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      ContentLength: sizeBytes,
      ContentType: PDF_MIME_TYPE,
      Key: objectKey,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // The presigner treats content-type as unsignable unless named here.
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );

  return {
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    objectKey,
    requiredHeaders: {
      "content-type": PDF_MIME_TYPE,
    },
    uploadUrl,
  };
}

/** Reads a stored PDF. Throws R2ObjectTooLargeError past `maxBytes`. */
export async function downloadObjectBytes(objectKey: string, maxBytes: number = MAX_PDF_BYTES) {
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("R2 object body was empty.");
  }

  return readBodyAsBytes(response.Body as AsyncIterable<unknown>, maxBytes);
}

export async function copyObject(sourceKey: string, destinationKey: string) {
  await getR2Client().send(
    new CopyObjectCommand({
      Bucket: getR2BucketName(),
      CopySource: buildCopySource(getR2BucketName(), sourceKey),
      Key: destinationKey,
    }),
  );
}

export async function deleteObject(objectKey: string) {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
    }),
  );
}

export async function createObjectDownloadUrl(
  objectKey: string,
  fileName?: string,
) {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
      ResponseContentDisposition: `inline; filename="${normalizePdfFileName(fileName)}"`,
      ResponseContentType: PDF_MIME_TYPE,
    }),
    {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    },
  );
}

export type HeadObjectResult =
  | {
      contentLength: number | null;
      exists: true;
      lastModified: string | null;
      metadata: Record<string, string>;
    }
  | { exists: false };

export type GetObjectResult = {
  bytes: Uint8Array;
  lastModified: string | null;
  metadata: Record<string, string>;
};

export type SignedObjectUrl = {
  expiresAt: string;
  url: string;
};

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

/** HEAD an object. Resolves `{ exists: false }` for a missing key; other failures throw. */
export async function headObject(objectKey: string): Promise<HeadObjectResult> {
  try {
    const response = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: getR2BucketName(),
        Key: objectKey,
      }),
    );

    return {
      contentLength:
        typeof response.ContentLength === "number" ? response.ContentLength : null,
      exists: true,
      lastModified: response.LastModified ? response.LastModified.toISOString() : null,
      metadata: response.Metadata ?? {},
    };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return { exists: false };
    }

    throw error;
  }
}

/**
 * GET an object with its metadata. Resolves null for a missing key; other
 * failures throw, including R2ObjectTooLargeError past `maxBytes`.
 */
export async function getObject(
  objectKey: string,
  maxBytes: number = MAX_PDF_BYTES,
): Promise<GetObjectResult | null> {
  try {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: objectKey,
      }),
    );

    if (!response.Body) {
      throw new Error("R2 object body was empty.");
    }

    return {
      bytes: await readBodyAsBytes(response.Body as AsyncIterable<unknown>, maxBytes),
      lastModified: response.LastModified ? response.LastModified.toISOString() : null,
      metadata: response.Metadata ?? {},
    };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return null;
    }

    throw error;
  }
}

export async function putObject(input: {
  body: Uint8Array;
  contentType: string;
  key: string;
  metadata?: Record<string, string>;
}) {
  await getR2Client().send(
    new PutObjectCommand({
      Body: input.body,
      Bucket: getR2BucketName(),
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      Key: input.key,
      ...(input.metadata ? { Metadata: input.metadata } : {}),
    }),
  );
}

/**
 * Signed inline URL for the embedded PDF viewer. The signature date is floored
 * to the start of the current UTC hour, so every call within the hour returns a
 * byte-identical URL (the browser cache and the iframe stay warm). The URL is
 * valid for two hours from that floor, so it always has at least one hour left.
 */
export async function createObjectViewerUrl(
  objectKey: string,
  fileName?: string,
  now: Date = new Date(),
): Promise<SignedObjectUrl> {
  const signingDate = new Date(
    Math.floor(now.getTime() / VIEWER_URL_SIGNING_WINDOW_MS) * VIEWER_URL_SIGNING_WINDOW_MS,
  );
  const url = await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
      ResponseCacheControl: VIEWER_CACHE_CONTROL,
      ResponseContentDisposition: `inline; filename="${normalizePdfFileName(fileName)}"`,
      ResponseContentType: PDF_MIME_TYPE,
    }),
    {
      expiresIn: VIEWER_URL_TTL_SECONDS,
      signingDate,
    },
  );

  return {
    expiresAt: new Date(
      signingDate.getTime() + VIEWER_URL_TTL_SECONDS * 1000,
    ).toISOString(),
    url,
  };
}

/** Short-lived signed URL that downloads the PDF as an attachment. */
export async function createObjectAttachmentUrl(
  objectKey: string,
  fileName?: string,
): Promise<SignedObjectUrl> {
  const url = await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${normalizePdfFileName(fileName)}"`,
      ResponseContentType: PDF_MIME_TYPE,
    }),
    {
      expiresIn: ATTACHMENT_URL_TTL_SECONDS,
    },
  );

  return {
    expiresAt: new Date(Date.now() + ATTACHMENT_URL_TTL_SECONDS * 1000).toISOString(),
    url,
  };
}
