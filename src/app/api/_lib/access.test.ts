import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkAccess,
  parseBasicAuthorization,
  requireAuthorizedRequest,
} from "./access";

function basic(value: string) {
  return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
}

describe("parseBasicAuthorization", () => {
  it("decodes a Basic header", () => {
    expect(parseBasicAuthorization(basic("sam:secret"))).toBe("sam:secret");
    expect(parseBasicAuthorization(basic("sam:pa:ss"))).toBe("sam:pa:ss");
  });

  it("rejects missing, non-Basic and colon-less values", () => {
    expect(parseBasicAuthorization(null)).toBeNull();
    expect(parseBasicAuthorization("Bearer abc")).toBeNull();
    expect(parseBasicAuthorization(basic("nocolon"))).toBeNull();
    expect(parseBasicAuthorization("Basic !!!")).toBeNull();
  });
});

describe("checkAccess", () => {
  it("allows everything when unset (the gate is opt-in)", () => {
    expect(checkAccess(null, {})).toEqual({ ok: true });
    expect(checkAccess(null, { credentials: "  " })).toEqual({ ok: true });
    expect(checkAccess(basic("sam:secret"), {})).toEqual({ ok: true });
  });

  it("fails closed when the secret is malformed", () => {
    expect(checkAccess(basic("a:b"), { credentials: "nocolon" })).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("accepts only the matching credentials when set", () => {
    const env = { credentials: "sam:secret" };

    expect(checkAccess(basic("sam:secret"), env)).toEqual({ ok: true });
    expect(checkAccess(basic("sam:wrong"), env)).toMatchObject({
      challenge: true,
      ok: false,
      status: 401,
    });
    expect(checkAccess(null, env)).toMatchObject({ challenge: true, status: 401 });
    expect(checkAccess("Bearer sam:secret", env)).toMatchObject({ status: 401 });
  });
});

describe("requireAuthorizedRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a 401 with a Basic challenge for a missing header", async () => {
    vi.stubEnv("APP_BASIC_AUTH", "sam:secret");

    const response = requireAuthorizedRequest(
      new Request("http://localhost/api/extractions", { method: "POST" }),
    );

    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
    expect(await response?.json()).toMatchObject({ error: "Sign in to make changes." });
  });

  it("returns null for matching credentials", () => {
    vi.stubEnv("APP_BASIC_AUTH", "sam:secret");

    const response = requireAuthorizedRequest(
      new Request("http://localhost/api/extractions", {
        headers: { authorization: basic("sam:secret") },
        method: "POST",
      }),
    );

    expect(response).toBeNull();
  });
});
