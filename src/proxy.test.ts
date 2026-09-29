import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { ACTOR_COOKIE_NAME, createUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/auth";

import { config, proxy } from "./proxy";

const UNLOCKED_ONLY = `${UNLOCK_COOKIE_NAME}=${createUnlockToken()}`;
const SIGNED_IN = `${UNLOCKED_ONLY}; ${ACTOR_COOKIE_NAME}=Sam%20Fourie`;

function request(
  path: string,
  init: { cookie?: string; method?: string; navigate?: boolean } = {},
) {
  const headers = new Headers();

  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }

  if (init.navigate) {
    headers.set("sec-fetch-mode", "navigate");
  }

  return new NextRequest(`http://localhost:3000${path}`, { headers, method: init.method ?? "GET" });
}

function passesThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  it("sends a locked page load to the PIN screen and remembers the page", () => {
    const response = proxy(request("/submissions?status=pending", { navigate: true }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/unlock?next=%2Fsubmissions%3Fstatus%3Dpending",
    );
  });

  it("answers a locked API call with the usual 401 body and no Basic challenge", async () => {
    const response = proxy(request("/api/submissions/abc/review", { method: "PATCH" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(await response.json()).toEqual({ code: "unknown", error: "Enter the PIN to continue." });
  });

  it("sends a locked PDF link opened in a tab to the PIN screen", () => {
    const response = proxy(request("/api/submissions/abc/pdf?page=3", { navigate: true }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/unlock?next=%2Fapi%2Fsubmissions%2Fabc%2Fpdf%3Fpage%3D3",
    );
  });

  it("always lets the PIN screen and the unlock route through", () => {
    expect(passesThrough(proxy(request("/unlock", { navigate: true })))).toBe(true);
    expect(passesThrough(proxy(request("/api/unlock", { method: "POST", navigate: true })))).toBe(true);
  });

  it("lets signed-in requests through and rejects a forged cookie", () => {
    expect(passesThrough(proxy(request("/reports", { cookie: SIGNED_IN })))).toBe(true);
    expect(
      passesThrough(proxy(request("/api/submissions/abc", { cookie: SIGNED_IN, method: "DELETE" }))),
    ).toBe(true);
    expect(
      proxy(request("/api/extractions", { cookie: `${UNLOCK_COOKIE_NAME}=1; ${ACTOR_COOKIE_NAME}=Sam`, method: "POST" }))
        .status,
    ).toBe(401);
  });

  it("asks an unlocked visitor with no name who they are", async () => {
    const page = proxy(request("/submissions", { cookie: UNLOCKED_ONLY, navigate: true }));
    const api = proxy(request("/api/submissions/abc/review", { cookie: UNLOCKED_ONLY, method: "PATCH" }));

    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://localhost:3000/unlock?next=%2Fsubmissions");
    expect(api.status).toBe(401);
    expect(await api.json()).toEqual({ code: "unknown", error: "Enter your name to continue." });
    expect(passesThrough(proxy(request("/unlock", { cookie: UNLOCKED_ONLY, navigate: true })))).toBe(true);
    expect(passesThrough(proxy(request("/api/identity", { cookie: UNLOCKED_ONLY, method: "POST" })))).toBe(true);
  });

  it("always lets Log out through", () => {
    expect(passesThrough(proxy(request("/api/logout", { method: "POST", navigate: true })))).toBe(true);
  });

  it("skips the sign-in screen once signed in", () => {
    const response = proxy(request("/unlock?next=%2Freports", { cookie: SIGNED_IN, navigate: true }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/reports");
  });

  it("gates pages and API routes but not the brand images", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

    expect(matches("/")).toBe(true);
    expect(matches("/submissions/abc")).toBe(true);
    expect(matches("/api/extractions")).toBe(true);
    expect(matches("/unlock")).toBe(true);
    expect(matches("/_next/static/chunks/app.js")).toBe(false);
    expect(matches("/_next/image?url=%2Fa.png&w=64&q=75")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/icon.svg")).toBe(false);
    expect(matches("/apple-icon.png")).toBe(false);
    expect(matches("/opengraph-image.png")).toBe(false);
  });
});
