import { MongoConfigError } from "@/lib/mongodb";
import {
  getSubmissionDetail,
  hasRetainedUploadSource,
} from "@/lib/submissions";
import {
  createObjectDownloadUrl,
  R2ConfigError,
} from "@/lib/r2";

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

function toRouteError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof MongoConfigError || error instanceof R2ConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected PDF download failure.", 500);
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/submissions/[submissionId]/pdf">,
) {
  try {
    const { submissionId } = await context.params;

    if (!submissionId || typeof submissionId !== "string") {
      throw new RouteError("A valid submission id is required.", 400);
    }

    const submission = await getSubmissionDetail(submissionId);

    if (!submission) {
      throw new RouteError("Submission not found.", 404);
    }

    if (!hasRetainedUploadSource(submission.intake.sourceMeta)) {
      throw new RouteError("Saved PDF is not available for this submission.", 404);
    }

    const downloadUrl = await createObjectDownloadUrl(
      submission.intake.sourceMeta.objectKey,
      submission.intake.sourceMeta.fileName,
    );

    return Response.redirect(downloadUrl, 307);
  } catch (error) {
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
