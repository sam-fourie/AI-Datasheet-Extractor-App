import { NextResponse, type NextRequest } from "next/server";

import { ACTOR_COOKIE_NAME, decideAccess, isUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { normalizeActorName } from "@/lib/identity";

const NO_STORE = { "cache-control": "no-store" };

/**
 * The PIN gate for every page and API request (rules in `decideAccess`,
 * `src/lib/auth.ts`). Page loads without the unlock cookie and a name redirect
 * to the PIN screen, and API calls get a 401 with the usual `{ code, error }`
 * body. Route handlers check again with `requireAuthorizedRequest`.
 */
export function proxy(request: NextRequest) {
  const decision = decideAccess({
    method: request.method,
    named: normalizeActorName(request.cookies.get(ACTOR_COOKIE_NAME)?.value) !== null,
    navigation: request.headers.get("sec-fetch-mode") === "navigate",
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    unlocked: isUnlockToken(request.cookies.get(UNLOCK_COOKIE_NAME)?.value),
  });

  if (decision.kind === "allow") {
    return NextResponse.next();
  }

  if (decision.kind === "redirect") {
    const response = NextResponse.redirect(new URL(decision.location, request.nextUrl));

    response.headers.set("cache-control", "no-store");

    return response;
  }

  return NextResponse.json({ code: "unknown", error: decision.message }, { headers: NO_STORE, status: 401 });
}

export const config = {
  matcher: [
    // Everything except Next's own assets (build output, image optimisation,
    // dev tooling) and the brand images in src/app: the PIN screen shows the
    // icons, and link unfurlers fetch the preview image without the cookie.
    "/((?!_next/|favicon\\.ico|icon\\.svg|apple-icon\\.png|opengraph-image\\.png).*)",
  ],
};
