import { MongoConfigError } from "@/lib/mongodb";
import { isPdfSourceCancelled } from "@/lib/pdf-source";
import { R2ConfigError } from "@/lib/r2";
import {
  ensurePdfViewerReady,
  type EnsuredPdfViewerState,
  type PdfViewerRouteError,
} from "@/lib/submissions/pdf-viewer";
import {
  getSubmissionIntake,
  isValidSubmissionId,
} from "@/lib/submissions/repository";

export const runtime = "nodejs";
// A first view of an uncached URL source fetches the vendor copy (30 s timeout).
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

function errorResponse(body: PdfViewerRouteError, status: number) {
  return Response.json(body, { headers: NO_STORE, status });
}

/**
 * Returns a signed viewer URL for the submission's PDF (JSON only; bytes never
 * pass through). POST because an uncached URL source is fetched from the
 * vendor and written to the R2 cache on first use.
 *
 * - 200 `{ status: "ready", url, expiresAt, fileName, sizeBytes, source, revision, cachedAt }`
 * - 404 `{ status: "unavailable", reason: "not-retained" }`
 * - 502 `{ status: "error", code: "source-unreachable", originalUrl, message }`
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/submissions/[submissionId]/pdf/viewer">,
) {
  try {
    const { submissionId } = await context.params;

    if (!isValidSubmissionId(submissionId)) {
      return errorResponse(
        { code: "invalid-request", error: "A valid submission id is required.", status: "error" },
        400,
      );
    }

    const submission = await getSubmissionIntake(submissionId);

    if (!submission) {
      return errorResponse(
        { code: "not-found", error: "Submission not found.", status: "error" },
        404,
      );
    }

    const state = await ensurePdfViewerReady(submission, { signal: request.signal });
    const status =
      state.status === "ready" ? 200 : state.status === "unavailable" ? 404 : 502;

    return Response.json(state satisfies EnsuredPdfViewerState, {
      headers: NO_STORE,
      status,
    });
  } catch (error) {
    // The client went away during the vendor download; no one reads this.
    if (isPdfSourceCancelled(error)) {
      return errorResponse(
        { code: "unknown", error: error.message, status: "error" },
        error.status,
      );
    }

    if (error instanceof MongoConfigError || error instanceof R2ConfigError) {
      return errorResponse(
        { code: "not-configured", error: error.message, status: "error" },
        500,
      );
    }

    return errorResponse(
      {
        code: "unknown",
        error: error instanceof Error ? error.message : "Unexpected PDF viewer failure.",
        status: "error",
      },
      500,
    );
  }
}
