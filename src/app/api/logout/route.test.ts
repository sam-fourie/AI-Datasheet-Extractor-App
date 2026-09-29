import { describe, expect, it } from "vitest";

import { ACTOR_COOKIE_NAME, UNLOCK_COOKIE_NAME } from "@/lib/auth";

import { POST } from "./route";

describe("POST /api/logout", () => {
  it("clears the unlock cookie and the name, then returns to the PIN screen", () => {
    const response = POST();
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/unlock");
    expect(response.headers.get("cache-control")).toBe("no-store");

    for (const name of [UNLOCK_COOKIE_NAME, ACTOR_COOKIE_NAME]) {
      const cookie = cookies.find((value) => value.startsWith(`${name}=`)) ?? "";

      expect(cookie).toMatch(/Max-Age=0/);
      expect(cookie).toMatch(/Path=\//);
    }
  });
});
