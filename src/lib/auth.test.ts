import { describe, expect, it } from "vitest";

import {
  APP_PIN,
  buildUnlockHref,
  createUnlockToken,
  decideAccess,
  isCorrectPin,
  isRequestUnlocked,
  isUnlockToken,
  readCookie,
  safeNextPath,
  UNLOCK_COOKIE_NAME,
  type AccessRequest,
} from "./auth";

describe("isCorrectPin", () => {
  it("accepts the PIN, ignoring surrounding spaces", () => {
    expect(isCorrectPin(APP_PIN)).toBe(true);
    expect(isCorrectPin(` ${APP_PIN} `)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isCorrectPin("")).toBe(false);
    expect(isCorrectPin(`${APP_PIN}9`)).toBe(false);
    expect(isCorrectPin("not the pin")).toBe(false);
    expect(isCorrectPin(null)).toBe(false);
    expect(isCorrectPin(Number(APP_PIN))).toBe(false);
  });
});

describe("isUnlockToken", () => {
  it("accepts the token for the current PIN only", () => {
    expect(isUnlockToken(createUnlockToken())).toBe(true);
    expect(isUnlockToken(createUnlockToken(`${APP_PIN}9`))).toBe(false);
  });

  it("rejects missing and made-up values", () => {
    expect(isUnlockToken(undefined)).toBe(false);
    expect(isUnlockToken(null)).toBe(false);
    expect(isUnlockToken("")).toBe(false);
    expect(isUnlockToken("1")).toBe(false);
  });
});

describe("readCookie", () => {
  it("finds one cookie by exact name", () => {
    expect(readCookie(`a=1; ${UNLOCK_COOKIE_NAME}=abc; b=2`, UNLOCK_COOKIE_NAME)).toBe("abc");
    expect(readCookie(`x${UNLOCK_COOKIE_NAME}=abc`, UNLOCK_COOKIE_NAME)).toBeNull();
    expect(readCookie("a=1", UNLOCK_COOKIE_NAME)).toBeNull();
    expect(readCookie(null, UNLOCK_COOKIE_NAME)).toBeNull();
  });

  it("decodes encoded values", () => {
    expect(readCookie("note=a%20b", "note")).toBe("a b");
    expect(readCookie("note=%E0%A4%A", "note")).toBe("%E0%A4%A");
  });
});

describe("isRequestUnlocked", () => {
  it("reads the unlock cookie from the request", () => {
    const unlocked = new Request("http://localhost/", {
      headers: { cookie: `${UNLOCK_COOKIE_NAME}=${createUnlockToken()}` },
    });

    expect(isRequestUnlocked(unlocked)).toBe(true);
    expect(isRequestUnlocked(new Request("http://localhost/"))).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and their query", () => {
    expect(safeNextPath("/submissions?status=pending")).toBe("/submissions?status=pending");
    expect(safeNextPath("/api/submissions/abc/pdf?page=3")).toBe("/api/submissions/abc/pdf?page=3");
    expect(safeNextPath("/")).toBe("/");
  });

  it("falls back to / for anything that could leave the site", () => {
    for (const value of [
      undefined,
      null,
      42,
      "",
      "submissions",
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example/",
      "/\t/evil.example/",
      `/${"a".repeat(2100)}`,
    ]) {
      expect(safeNextPath(value)).toBe("/");
    }
  });

  it("never points back at the PIN screen", () => {
    expect(safeNextPath("/unlock?next=%2Freports")).toBe("/");
    expect(safeNextPath("/api/unlock")).toBe("/");
  });

  it("drops Next's internal _rsc parameter", () => {
    expect(safeNextPath("/submissions?_rsc=1a2b&status=pending")).toBe("/submissions?status=pending");
  });
});

describe("buildUnlockHref", () => {
  it("omits the defaults", () => {
    expect(buildUnlockHref()).toBe("/unlock");
    expect(buildUnlockHref({ next: "/" })).toBe("/unlock");
    expect(buildUnlockHref({ next: "//evil.example/" })).toBe("/unlock");
  });

  it("carries the next path and a failed attempt", () => {
    expect(buildUnlockHref({ next: "/submissions?x=1" })).toBe("/unlock?next=%2Fsubmissions%3Fx%3D1");
    expect(buildUnlockHref({ failed: true, next: "/reports" })).toBe("/unlock?error=1&next=%2Freports");
  });
});

describe("decideAccess", () => {
  function request(overrides: Partial<AccessRequest> = {}): AccessRequest {
    return { method: "GET", navigation: true, pathname: "/", search: "", unlocked: false, ...overrides };
  }

  it("sends locked page loads to the PIN screen with the page as next", () => {
    expect(decideAccess(request())).toEqual({ kind: "redirect", location: "/unlock" });
    expect(decideAccess(request({ pathname: "/submissions", search: "?status=pending" }))).toEqual({
      kind: "redirect",
      location: "/unlock?next=%2Fsubmissions%3Fstatus%3Dpending",
    });
    expect(decideAccess(request({ method: "HEAD", navigation: false, pathname: "/reports" }))).toEqual({
      kind: "redirect",
      location: "/unlock?next=%2Freports",
    });
  });

  it("denies locked API calls but redirects a locked navigation to an API URL", () => {
    expect(decideAccess(request({ navigation: false, pathname: "/api/submissions/abc/pdf/viewer" }))).toEqual({
      kind: "deny",
    });
    expect(decideAccess(request({ method: "PATCH", navigation: false, pathname: "/api/submissions/abc/review" }))).toEqual({
      kind: "deny",
    });
    expect(decideAccess(request({ pathname: "/api/submissions/abc/pdf", search: "?page=3" }))).toEqual({
      kind: "redirect",
      location: "/unlock?next=%2Fapi%2Fsubmissions%2Fabc%2Fpdf%3Fpage%3D3",
    });
  });

  it("denies locked writes to pages", () => {
    expect(decideAccess(request({ method: "POST", pathname: "/submissions" }))).toEqual({ kind: "deny" });
  });

  it("always lets the PIN screen and the unlock route through", () => {
    expect(decideAccess(request({ pathname: "/unlock" }))).toEqual({ kind: "allow" });
    expect(decideAccess(request({ method: "POST", navigation: true, pathname: "/api/unlock" }))).toEqual({
      kind: "allow",
    });
  });

  it("lets unlocked requests through", () => {
    expect(decideAccess(request({ pathname: "/submissions", unlocked: true }))).toEqual({ kind: "allow" });
    expect(decideAccess(request({ method: "DELETE", navigation: false, pathname: "/api/submissions/abc", unlocked: true }))).toEqual({
      kind: "allow",
    });
  });

  it("skips the PIN screen once unlocked", () => {
    expect(decideAccess(request({ pathname: "/unlock", search: "?next=%2Freports", unlocked: true }))).toEqual({
      kind: "redirect",
      location: "/reports",
    });
    expect(decideAccess(request({ pathname: "/unlock", search: "?next=https%3A%2F%2Fevil.example", unlocked: true }))).toEqual({
      kind: "redirect",
      location: "/",
    });
  });
});
