import { NextResponse } from "next/server";

import { ACTOR_COOKIE_NAME, UNLOCK_COOKIE_NAME, UNLOCK_PAGE_PATH } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Log out: clears the unlock cookie and the name, then returns to the PIN
 * screen, so the next person enters the PIN and says who they are. The
 * sidebar and the mobile account menu post a plain form here, so the browser
 * follows the 303 with a full page load. Always reachable, even when locked.
 */
export function POST() {
  const response = new NextResponse(null, {
    headers: { "Cache-Control": "no-store", Location: UNLOCK_PAGE_PATH },
    status: 303,
  });

  for (const name of [UNLOCK_COOKIE_NAME, ACTOR_COOKIE_NAME]) {
    response.cookies.set(name, "", { httpOnly: true, maxAge: 0, path: "/", sameSite: "lax" });
  }

  return response;
}
