import { describe, expect, it } from "vitest";

import { ACTOR_COOKIE_NAME, createUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/auth";

import { requireAuthorizedRequest } from "./access";

const UNLOCKED_ONLY = `${UNLOCK_COOKIE_NAME}=${createUnlockToken()}`;

function request(cookie?: string) {
  return new Request("http://localhost/api/extractions", {
    headers: cookie ? { cookie } : undefined,
    method: "POST",
  });
}

describe("requireAuthorizedRequest", () => {
  it("returns null with a valid unlock cookie and a name", () => {
    expect(requireAuthorizedRequest(request(`${UNLOCKED_ONLY}; ${ACTOR_COOKIE_NAME}=Sam`))).toBeNull();
  });

  it("returns a 401 without the unlock cookie, and no Basic challenge", async () => {
    const response = requireAuthorizedRequest(request(`${ACTOR_COOKIE_NAME}=Sam`));

    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toBeNull();
    expect(await response?.json()).toEqual({ code: "unknown", error: "Enter the PIN to continue." });
  });

  it("returns a 401 asking for a name when unlocked without one", async () => {
    const response = requireAuthorizedRequest(request(UNLOCKED_ONLY));

    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ code: "unknown", error: "Enter your name to continue." });
  });

  it("returns a 401 for a forged unlock cookie", () => {
    expect(requireAuthorizedRequest(request(`${UNLOCK_COOKIE_NAME}=unlocked; ${ACTOR_COOKIE_NAME}=Sam`))?.status).toBe(401);
  });
});
