import { requireAuthorizedRequest } from "@/app/api/_lib/access";
import { readActorName } from "@/lib/auth";
import { MongoConfigError } from "@/lib/mongodb";
import {
  deleteSubmission,
  getSubmissionDetail,
  hasRetainedUploadSource,
} from "@/lib/submissions";
import { isUrlCacheObjectKey } from "@/lib/pdf-cache";
import {
  deleteObject,
  R2ConfigError,
} from "@/lib/r2";
import {
  deleteSubmissionWithRuns,
  isValidSubmissionId,
} from "@/lib/submissions/repository";

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

  if (error instanceof MongoConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof R2ConfigError) {
    return new RouteError(error.message, 500);
  }

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected submission deletion failure.", 500);
}

/**
 * Deleted submissions leave no record to show a name on, so who deleted what
 * goes to the server log (Vercel runtime logs).
 */
function logDeletion(deletedIds: readonly string[], actor: string | null) {
  console.info(`Deleted ${deletedIds.join(", ")} (by ${actor ?? "an unknown person"}).`);
}

/**
 * `?cascade=runs` deletes the submission and every re-run compared against it:
 * Mongo documents first, then their retained upload objects best-effort
 * (addendum Q). URL-cache objects are shared and never deleted.
 */
async function deleteWithRuns(submissionId: string, actor: string | null) {
  const { deletedIds, uploadObjectKeys } = await deleteSubmissionWithRuns(submissionId);

  if (deletedIds.length === 0) {
    throw new RouteError("Submission not found.", 404);
  }

  logDeletion(deletedIds, actor);

  for (const objectKey of uploadObjectKeys) {
    if (isUrlCacheObjectKey(objectKey)) {
      continue;
    }

    try {
      await deleteObject(objectKey);
    } catch (error) {
      console.warn(`Could not delete R2 object ${objectKey}.`, error);
    }
  }

  return Response.json({
    deletedIds,
    submissionId,
    success: true,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/submissions/[submissionId]">,
) {
  const unauthorized = requireAuthorizedRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { submissionId } = await context.params;

    if (!isValidSubmissionId(submissionId)) {
      throw new RouteError("A valid submission id is required.", 400);
    }

    if (new URL(request.url).searchParams.get("cascade") === "runs") {
      return await deleteWithRuns(submissionId, readActorName(request));
    }

    const existingSubmission = await getSubmissionDetail(submissionId);

    if (!existingSubmission) {
      throw new RouteError("Submission not found.", 404);
    }

    if (hasRetainedUploadSource(existingSubmission.intake.sourceMeta)) {
      await deleteObject(existingSubmission.intake.sourceMeta.objectKey);
    }

    const didDelete = await deleteSubmission(submissionId);

    if (!didDelete) {
      throw new RouteError("Submission not found.", 404);
    }

    logDeletion([submissionId], readActorName(request));

    return Response.json({
      deletedIds: [submissionId],
      submissionId,
      success: true,
    });
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
