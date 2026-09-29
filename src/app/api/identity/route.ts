import { NextResponse, type NextRequest } from "next/server";

import {
  ACTOR_COOKIE_NAME,
  ACTOR_MAX_AGE_SECONDS,
  buildUnlockHref,
  isRequestUnlocked,
  LOCKED_MESSAGE,
  safeNextPath,
} from "@/lib/auth";
import { normalizeActorName } from "@/lib/identity";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const NAME_MESSAGE = "Enter your name.";

function isHttpsRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"
  );
}

/** A 303 with a relative Location, so the browser stays on its own host. */
function redirectTo(path: string) {
  return new NextResponse(null, { headers: { ...NO_STORE, Location: path }, status: 303 });
}

/**
 * The "Who is this?" step posts the name and `next` here as form data, once
 * the PIN is in (the unlock cookie is required). The name is saved in the
 * `dx_name` cookie for a year, or until Log out. The name step sends
 * `Accept: application/json` and gets 200 `{ next }`, or 400
 * `{ code: "invalid-name", error }`. A plain form post gets a 303 instead.
 */
export async function POST(request: NextRequest) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  if (!isRequestUnlocked(request)) {
    return NextResponse.json({ code: "unknown", error: LOCKED_MESSAGE }, { headers: NO_STORE, status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get("next"));
  const name = normalizeActorName(form?.get("name"));

  if (!name) {
    return wantsJson
      ? NextResponse.json({ code: "invalid-name", error: NAME_MESSAGE }, { headers: NO_STORE, status: 400 })
      : redirectTo(buildUnlockHref({ next }));
  }

  const response = wantsJson ? NextResponse.json({ next }, { headers: NO_STORE }) : redirectTo(next);

  response.cookies.set(ACTOR_COOKIE_NAME, name, {
    httpOnly: true,
    maxAge: ACTOR_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: isHttpsRequest(request),
  });

  return response;
}
