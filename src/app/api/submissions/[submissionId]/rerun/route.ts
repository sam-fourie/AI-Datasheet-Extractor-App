import { ObjectId } from "mongodb";
import { after } from "next/server";

import { requireAuthorizedRequest } from "@/app/api/_lib/access";
import { extractDatasheet } from "@/lib/ai";
import { ExtractionTimeoutError } from "@/lib/ai/errors";
import {
  ExtractionSettingsError,
  resolveExtractionSettings,
} from "@/lib/ai/settings";
import { MongoConfigError } from "@/lib/mongodb";
import { looksLikePdf, normalizePdfFileName } from "@/lib/pdf";
import {
  cacheUrlSourcePdf,
  readCachedUrlSourcePdf,
  sha256Hex,
} from "@/lib/pdf-cache";
import { PdfSourceError, readPdfFromUrl } from "@/lib/pdf-source";
import {
  buildSubmissionPdfObjectKey,
  copyObject,
  deleteObject,
  downloadObjectBytes,
  R2ConfigError,
} from "@/lib/r2";
import {
  buildExtractionSnapshot,
  createSubmission,
  getSubmissionDetail,
  hasRetainedUploadSource,
  isValidSubmissionId,
  type SubmissionDetail,
  type SubmissionIntakeSnapshot,
  type UrlSourceMeta,
} from "@/lib/submissions";

export const runtime = "nodejs";
export const maxDuration = 300;

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

type UrlCacheWrite = {
  contentSha256: string | null;
  normalizedUrl: string;
};

type ResolvedPdf = {
  /** sha256 of the bytes this re-run extracts, for URL sources. */
  contentSha256: string | null;
  /** Cache keys to write the bytes to after the response (write-through). */
  cacheWrites: UrlCacheWrite[];
  pdfBytes: Uint8Array;
  pdfFileName: string;
  sourceObjectKey: string | null;
};

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof PdfSourceError) {
    return error;
  }

  if (error instanceof ExtractionTimeoutError) {
    return new RouteError(error.message, 504);
  }

  if (error instanceof MongoConfigError || error instanceof R2ConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected re-run failure.", 500);
}

function resolveRequestedExtractionSettings(value: Record<string, unknown>) {
  try {
    return resolveExtractionSettings({
      model: value.model,
      reasoningEffort: value.reasoningEffort,
    });
  } catch (error) {
    if (error instanceof ExtractionSettingsError) {
      throw new RouteError(error.message, 400);
    }

    throw error;
  }
}

async function readCachedCopy(normalizedUrl: string, contentSha256: string | null) {
  try {
    return await readCachedUrlSourcePdf(normalizedUrl, contentSha256);
  } catch (error) {
    if (error instanceof R2ConfigError) {
      throw error;
    }

    console.warn("Could not read the cached URL-source PDF.", error);

    return null;
  }
}

/**
 * URL sources (addendum F): with `contentSha256`, read the exact cached
 * revision first and fall back to the vendor; without it, try the vendor first
 * and fall back to the legacy cached copy. Bytes fetched from the vendor are
 * written through to the cache after the response.
 */
async function readUrlSourcePdf(sourceMeta: UrlSourceMeta): Promise<ResolvedPdf> {
  const { normalizedUrl } = sourceMeta;
  const pdfFileName = normalizePdfFileName(sourceMeta.pdfFileName);
  const fromCache = (bytes: Uint8Array): ResolvedPdf => {
    const digest = sha256Hex(bytes);

    return {
      cacheWrites: [{ contentSha256: digest, normalizedUrl }],
      contentSha256: digest,
      pdfBytes: bytes,
      pdfFileName,
      sourceObjectKey: null,
    };
  };

  if (sourceMeta.contentSha256) {
    const exact = await readCachedCopy(normalizedUrl, sourceMeta.contentSha256);

    if (exact) {
      return { ...fromCache(exact.bytes), cacheWrites: [] };
    }
  }

  let vendorError: unknown;

  try {
    const source = await readPdfFromUrl(normalizedUrl);
    const digest = sha256Hex(source.pdfBytes);

    return {
      cacheWrites: [
        { contentSha256: digest, normalizedUrl },
        // Legacy submissions also get a viewer copy under the legacy key.
        ...(sourceMeta.contentSha256 ? [] : [{ contentSha256: null, normalizedUrl }]),
      ],
      contentSha256: digest,
      pdfBytes: source.pdfBytes,
      pdfFileName: source.pdfFileName,
      sourceObjectKey: null,
    };
  } catch (error) {
    vendorError = error;
  }

  if (!sourceMeta.contentSha256) {
    const latest = await readCachedCopy(normalizedUrl, null);

    if (latest) {
      return fromCache(latest.bytes);
    }
  }

  throw vendorError;
}

async function readSubmissionPdf(submission: SubmissionDetail): Promise<ResolvedPdf> {
  const sourceMeta = submission.intake.sourceMeta;

  if (sourceMeta.kind === "url") {
    return readUrlSourcePdf(sourceMeta);
  }

  if (!hasRetainedUploadSource(sourceMeta)) {
    throw new RouteError(
      "The original PDF was not retained for this submission, so it cannot be re-run. Submit it again from the intake workbench.",
      409,
    );
  }

  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await downloadObjectBytes(sourceMeta.objectKey);
  } catch {
    throw new RouteError("The stored PDF could not be read from storage.", 500);
  }

  if (!looksLikePdf(pdfBytes)) {
    throw new RouteError("The stored file does not appear to be a valid PDF.", 500);
  }

  return {
    cacheWrites: [],
    contentSha256: null,
    pdfBytes,
    pdfFileName: normalizePdfFileName(sourceMeta.fileName),
    sourceObjectKey: sourceMeta.objectKey,
  };
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/submissions/[submissionId]/rerun">,
) {
  const unauthorized = requireAuthorizedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  let copiedObjectKey: string | null = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new RouteError("OPENAI_API_KEY is not configured on the server.", 500);
    }

    const { submissionId } = await context.params;

    if (!isValidSubmissionId(submissionId)) {
      throw new RouteError("A valid submission id is required.", 400);
    }

    const body = await request.json().catch(() => null);
    const settings = resolveRequestedExtractionSettings(
      body && typeof body === "object" ? (body as Record<string, unknown>) : {},
    );
    const sourceSubmission = await getSubmissionDetail(submissionId);

    if (!sourceSubmission) {
      throw new RouteError("Submission not found.", 404);
    }

    // Re-runs always compare against the root baseline so that every run of a
    // datasheet lands in one group, even when started from another re-run.
    const rootSubmissionId = sourceSubmission.comparison?.baselineSubmissionId;
    const rootSubmission = rootSubmissionId
      ? await getSubmissionDetail(rootSubmissionId)
      : null;
    const baseline = rootSubmission ?? sourceSubmission;
    const pdf = await readSubmissionPdf(sourceSubmission);
    const extraction = await extractDatasheet({
      model: settings.model,
      packageCategory: baseline.intake.packageCategory,
      partNumber: baseline.intake.partNumber,
      pdfBytes: pdf.pdfBytes,
      pdfFileName: pdf.pdfFileName,
      reasoningEffort: settings.reasoningEffort,
      requestedFields: baseline.intake.requestedFields,
      sourceLabel: baseline.intake.sourceLabel,
    });
    const newSubmissionId = new ObjectId().toHexString();
    let intake: SubmissionIntakeSnapshot = {
      ...sourceSubmission.intake,
      requestedFields: [...sourceSubmission.intake.requestedFields],
    };

    if (sourceSubmission.intake.sourceMeta.kind === "url" && pdf.contentSha256) {
      // Record the revision this run actually extracted (it can differ from the
      // source's when the cache missed and the vendor has changed the file).
      intake = {
        ...intake,
        sourceMeta: {
          ...sourceSubmission.intake.sourceMeta,
          contentSha256: pdf.contentSha256,
        },
      };
    }

    if (pdf.sourceObjectKey && sourceSubmission.intake.sourceMeta.kind === "upload") {
      const newObjectKey = buildSubmissionPdfObjectKey(
        newSubmissionId,
        sourceSubmission.intake.sourceMeta.fileName,
      );

      await copyObject(pdf.sourceObjectKey, newObjectKey);
      copiedObjectKey = newObjectKey;
      intake = {
        ...intake,
        sourceMeta: {
          ...sourceSubmission.intake.sourceMeta,
          objectKey: newObjectKey,
        },
      };
    }

    const submission = await createSubmission({
      comparison: {
        baselineSubmissionId: baseline.submissionId,
      },
      extraction: buildExtractionSnapshot(extraction),
      intake,
      submissionId: newSubmissionId,
    });

    copiedObjectKey = null;

    if (pdf.cacheWrites.length > 0) {
      const { cacheWrites, pdfBytes } = pdf;

      after(async () => {
        for (const write of cacheWrites) {
          try {
            await cacheUrlSourcePdf({ ...write, pdfBytes });
          } catch (error) {
            console.warn("Could not cache the URL-source PDF.", error);
          }
        }
      });
    }

    return Response.json(submission satisfies SubmissionDetail);
  } catch (error) {
    if (copiedObjectKey) {
      try {
        await deleteObject(copiedObjectKey);
      } catch {
        // Bucket lifecycle rules cover orphaned copies.
      }
    }

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
