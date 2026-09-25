import { BASIC_AUTH_CHALLENGE, checkRequestAccess } from "@/lib/auth";

/*
 * The route-handler side of the access gate (the logic lives in
 * src/lib/auth.ts). src/proxy.ts runs the same check optimistically for every
 * page and API request; this is the authoritative check for mutations.
 */
export {
  ACCESS_ENV_VAR,
  checkAccess,
  parseBasicAuthorization,
  type AccessDecision,
  type AccessEnv,
} from "@/lib/auth";

/**
 * Call at the top of a mutating route handler: returns an error `Response` to
 * send as-is when the request is not authorized, or null to continue.
 */
export function requireAuthorizedRequest(request: Request): Response | null {
  const decision = checkRequestAccess(request.headers.get("authorization"));

  if (decision.ok) {
    return null;
  }

  return Response.json(
    {
      code: decision.status === 401 ? "unknown" : "not-configured",
      error: decision.message,
    },
    {
      headers: decision.challenge
        ? { "WWW-Authenticate": BASIC_AUTH_CHALLENGE }
        : undefined,
      status: decision.status,
    },
  );
}
