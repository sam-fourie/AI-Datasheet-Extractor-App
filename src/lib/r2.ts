import { randomUUID } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  PDF_MIME_TYPE,
  normalizePdfFileName,
} from "@/lib/pdf";

const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

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

async function readBodyAsBytes(body: AsyncIterable<unknown>) {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for await (const chunk of body) {
    const bytes = toUint8Array(chunk);

    chunks.push(bytes);
    totalLength += bytes.byteLength;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
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

export async function createPdfUploadUrl(fileName: string) {
  const objectKey = buildPendingPdfObjectKey(fileName);
  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      ContentType: PDF_MIME_TYPE,
      Key: objectKey,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
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

export async function downloadObjectBytes(objectKey: string) {
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("R2 object body was empty.");
  }

  return readBodyAsBytes(response.Body as AsyncIterable<unknown>);
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
