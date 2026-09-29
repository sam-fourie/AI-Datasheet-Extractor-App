import { NextResponse, type NextRequest } from "next/server";

import {
  buildUnlockHref,
  createUnlockToken,
  isCorrectPin,
  safeNextPath,
  UNLOCK_COOKIE_NAME,
  UNLOCK_MAX_AGE_SECONDS,
} from "@/lib/auth";

export const runtime = "nodejs";

function isHttpsRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"
  );
}

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * A 303, so the browser follows the form POST with a GET. The Location is
 * relative, so the browser stays on the host it used: the route's own URL can
 * name a different host (in dev it's always localhost).
 */
function redirectTo(path: string) {
  return new NextResponse(null, { headers: { ...NO_STORE, Location: path }, status: 303 });
}

/**
 * The PIN screen posts the PIN and `next` here as form data. The PIN boxes
 * send `Accept: application/json` and get JSON back: 200 `{ next }` with the
 * unlock cookie, or 401 `{ code: "incorrect-pin", error }`. A plain form post
 * (no JavaScript) gets a 303 to `next`, or back to the PIN screen with an
 * error. This is the one route that doesn't call `requireAuthorizedRequest`.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get("next"));
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  if (!isCorrectPin(form?.get("pin"))) {
    return wantsJson
      ? NextResponse.json(
          { code: "incorrect-pin", error: "Incorrect PIN." },
          { headers: NO_STORE, status: 401 },
        )
      : redirectTo(buildUnlockHref({ failed: true, next }));
  }

  const response = wantsJson
    ? NextResponse.json({ next }, { headers: NO_STORE })
    : redirectTo(next);

  response.cookies.set(UNLOCK_COOKIE_NAME, createUnlockToken(), {
    httpOnly: true,
    maxAge: UNLOCK_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: isHttpsRequest(request),
  });

  return response;
}
