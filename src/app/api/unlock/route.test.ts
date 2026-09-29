import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { APP_PIN, createUnlockToken, UNLOCK_COOKIE_NAME, UNLOCK_MAX_AGE_SECONDS } from "@/lib/auth";

import { POST } from "./route";

function submit(fields: Record<string, string>, origin = "http://localhost:3000") {
  return POST(
    new NextRequest(`${origin}/api/unlock`, { body: new URLSearchParams(fields), method: "POST" }),
  );
}

describe("POST /api/unlock", () => {
  it("sets the unlock cookie and returns to next for the right PIN", async () => {
    const response = await submit({ next: "/submissions?status=pending", pin: APP_PIN });
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/submissions?status=pending");
    expect(cookie).toContain(`${UNLOCK_COOKIE_NAME}=${createUnlockToken()}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toContain(`Max-Age=${UNLOCK_MAX_AGE_SECONDS}`);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure over HTTPS", async () => {
    const response = await submit({ pin: APP_PIN }, "https://datasheets.example");

    expect(response.headers.get("location")).toBe("https://datasheets.example/");
    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("goes back to the PIN screen with an error for a wrong PIN", async () => {
    const response = await submit({ next: "/reports", pin: `${APP_PIN}9` });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/unlock?error=1&next=%2Freports");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("never sends anyone off the site", async () => {
    const response = await submit({ next: "//evil.example/", pin: APP_PIN });

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("treats a body that isn't a form as a wrong PIN", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/unlock", {
        body: JSON.stringify({ pin: APP_PIN }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/unlock?error=1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
