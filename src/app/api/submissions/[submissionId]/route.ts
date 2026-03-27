import { MongoConfigError } from "@/lib/mongodb";
import { deleteSubmission } from "@/lib/submissions";

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

  if (error instanceof Error) {
    return new RouteError(error.message, 500);
  }

  return new RouteError("Unexpected submission deletion failure.", 500);
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/submissions/[submissionId]">,
) {
  try {
    const { submissionId } = await context.params;

    if (!submissionId || typeof submissionId !== "string") {
      throw new RouteError("A valid submission id is required.", 400);
    }

    const didDelete = await deleteSubmission(submissionId);

    if (!didDelete) {
      throw new RouteError("Submission not found.", 404);
    }

    return Response.json({
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
