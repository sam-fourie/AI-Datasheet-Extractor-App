import { isRequestUnlocked, LOCKED_MESSAGE, readActorName, UNNAMED_MESSAGE } from "@/lib/auth";

/*
 * The route-handler side of the PIN gate (the logic lives in src/lib/auth.ts).
 * src/proxy.ts runs the same check for every page and API request; this is
 * the check next to the data.
 */

function unauthorized(message: string) {
  return Response.json(
    { code: "unknown", error: message },
    { headers: { "Cache-Control": "no-store" }, status: 401 },
  );
}

/**
 * Call at the top of every route handler except `/api/unlock`,
 * `/api/identity` and `/api/logout`: returns a 401 `Response` to send as-is
 * when the request lacks a valid unlock cookie or a name, or null to
 * continue. After it passes, `readActorName(request)` is the person to
 * record.
 */
export function requireAuthorizedRequest(request: Request): Response | null {
  if (!isRequestUnlocked(request)) {
    return unauthorized(LOCKED_MESSAGE);
  }

  if (readActorName(request) === null) {
    return unauthorized(UNNAMED_MESSAGE);
  }

  return null;
}
