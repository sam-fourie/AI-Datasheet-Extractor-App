import { MongoConfigError } from "@/lib/mongodb";
import { isPdfSourceCancelled } from "@/lib/pdf-source";
import { R2ConfigError } from "@/lib/r2";
import { ensurePdfViewerReady } from "@/lib/submissions/pdf-viewer";
import {
  getSubmissionIntake,
  isValidSubmissionId,
} from "@/lib/submissions/repository";

export const runtime = "nodejs";
// A first view of an uncached URL source fetches the vendor copy (30 s timeout).
export const maxDuration = 60;

type PdfRouteErrorCode =
  | "invalid-request"
  | "not-configured"
  | "not-found"
  | "not-retained"
  | "source-unreachable"
  | "unknown";

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: PdfRouteErrorCode,
    readonly originalUrl?: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof MongoConfigError || error instanceof R2ConfigError) {
    return new RouteError(error.message, 500, "not-configured");
  }

  // The client went away during the vendor download; no one reads this.
  if (isPdfSourceCancelled(error)) {
    return new RouteError(error.message, error.status, "unknown");
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500, "unknown");
  }

  return new RouteError("Unexpected PDF download failure.", 500, "unknown");
}

const MAX_PAGE = 10_000;

/** A positive integer page no greater than 10000; anything else is ignored. */
function parsePage(value: string | null) {
  if (!value || !/^\d{1,5}$/.test(value)) {
    return null;
  }

  const page = Number(value);

  return page > 0 && page <= MAX_PAGE ? page : null;
}

/**
 * 307s to a signed R2 URL for the submission's PDF, caching URL sources lazily
 * on first use. `?page=N` appends `#page=N`; `?download=1` signs an attachment
 * URL with a 5-minute TTL instead of the inline viewer URL. PDF bytes never
 * pass through this response.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/submissions/[submissionId]/pdf">,
) {
  try {
    const { submissionId } = await context.params;

    if (!isValidSubmissionId(submissionId)) {
      throw new RouteError("A valid submission id is required.", 400, "invalid-request");
    }

    const searchParams = new URL(request.url).searchParams;
    const page = parsePage(searchParams.get("page"));
    const download = searchParams.get("download") === "1";
    const submission = await getSubmissionIntake(submissionId);

    if (!submission) {
      throw new RouteError("Submission not found.", 404, "not-found");
    }

    const state = await ensurePdfViewerReady(submission, { download, signal: request.signal });

    if (state.status === "unavailable") {
      throw new RouteError(
        "Saved PDF is not available for this submission.",
        404,
        "not-retained",
      );
    }

    if (state.status === "error") {
      throw new RouteError(state.message, 502, state.code, state.originalUrl);
    }

    return new Response(null, {
      headers: {
        "Cache-Control": "private, no-store",
        Location: page ? `${state.url}#page=${page}` : state.url,
      },
      status: 307,
    });
  } catch (error) {
    const routeError = toRouteError(error);

    return Response.json(
      {
        code: routeError.code,
        error: routeError.message,
        ...(routeError.originalUrl ? { originalUrl: routeError.originalUrl } : {}),
      },
      {
        status: routeError.status,
      },
    );
  }
}
