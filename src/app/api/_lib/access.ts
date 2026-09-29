import { isRequestUnlocked, LOCKED_MESSAGE } from "@/lib/auth";

/*
 * The route-handler side of the PIN gate (the logic lives in src/lib/auth.ts).
 * src/proxy.ts runs the same check for every page and API request; this is
 * the check next to the data.
 */

/**
 * Call at the top of every route handler except `/api/unlock`: returns a 401
 * `Response` to send as-is when the request has no valid unlock cookie, or
 * null to continue.
 */
export function requireAuthorizedRequest(request: Request): Response | null {
  if (isRequestUnlocked(request)) {
    return null;
  }

  return Response.json(
    { code: "unknown", error: LOCKED_MESSAGE },
    { headers: { "Cache-Control": "no-store" }, status: 401 },
  );
}
