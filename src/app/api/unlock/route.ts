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

/** 303, so the browser follows the form POST with a GET. */
function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.nextUrl), 303);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

/**
 * The PIN screen's form posts here as a plain HTML form, so it works without
 * JavaScript. The right PIN sets the unlock cookie and returns to `next`. A
 * wrong one goes back to the PIN screen with an error. This is the one route
 * that doesn't call `requireAuthorizedRequest`.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get("next"));

  if (!isCorrectPin(form?.get("pin"))) {
    return redirectTo(request, buildUnlockHref({ failed: true, next }));
  }

  const response = redirectTo(request, next);

  response.cookies.set(UNLOCK_COOKIE_NAME, createUnlockToken(), {
    httpOnly: true,
    maxAge: UNLOCK_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: isHttpsRequest(request),
  });

  return response;
}
