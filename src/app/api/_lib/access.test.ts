import { describe, expect, it } from "vitest";

import { createUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/auth";

import { requireAuthorizedRequest } from "./access";

function request(cookie?: string) {
  return new Request("http://localhost/api/extractions", {
    headers: cookie ? { cookie } : undefined,
    method: "POST",
  });
}

describe("requireAuthorizedRequest", () => {
  it("returns null with a valid unlock cookie", () => {
    expect(requireAuthorizedRequest(request(`${UNLOCK_COOKIE_NAME}=${createUnlockToken()}`))).toBeNull();
  });

  it("returns a 401 without the cookie, and no Basic challenge", async () => {
    const response = requireAuthorizedRequest(request());

    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toBeNull();
    expect(await response?.json()).toEqual({ code: "unknown", error: "Enter the PIN to continue." });
  });

  it("returns a 401 for a forged cookie", () => {
    expect(requireAuthorizedRequest(request(`${UNLOCK_COOKIE_NAME}=unlocked`))?.status).toBe(401);
  });
});
