import { NextResponse, type NextRequest } from "next/server";

import { BASIC_AUTH_CHALLENGE, checkRequestAccess } from "@/lib/auth";

/**
 * Page-level access gate (optimistic). Runs the same `APP_BASIC_AUTH` check as
 * the route handlers for every page, RSC and API request, so the browser asks
 * for the login when a page first loads rather than on the first mutation,
 * and read-only pages, the archive and the GET PDF routes stop being public.
 * The route-handler gate (src/app/api/_lib/access.ts) stays the authoritative
 * check for mutations.
 *
 * Opt-in: without `APP_BASIC_AUTH` every request passes through unchanged.
 */
export function proxy(request: NextRequest) {
  const decision = checkRequestAccess(request.headers.get("authorization"));

  if (decision.ok) {
    return NextResponse.next();
  }

  const headers = new Headers({ "cache-control": "no-store" });

  if (decision.challenge) {
    headers.set("WWW-Authenticate", BASIC_AUTH_CHALLENGE);
  }

  // API clients parse `{ code, error }`, the same body the route gate sends.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        code: decision.status === 401 ? "unknown" : "not-configured",
        error: decision.message,
      },
      { headers, status: decision.status },
    );
  }

  headers.set("content-type", "text/plain; charset=utf-8");

  return new NextResponse(
    decision.status === 401 ? "Sign in to use the Datasheet Extractor." : decision.message,
    { headers, status: decision.status },
  );
}

export const config = {
  matcher: [
    // Everything except build assets, image optimisation and the favicon.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
