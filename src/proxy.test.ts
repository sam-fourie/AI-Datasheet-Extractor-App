import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

function request(path: string, authorization?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

function basic(value: string) {
  return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
}

function passesThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets everything through locally when APP_BASIC_AUTH is unset", () => {
    vi.stubEnv("APP_BASIC_AUTH", "");
    vi.stubEnv("VERCEL_ENV", "");

    expect(passesThrough(proxy(request("/submissions")))).toBe(true);
  });

  it("challenges a page request without the login", async () => {
    vi.stubEnv("APP_BASIC_AUTH", "sam:secret");

    const response = proxy(request("/submissions"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/^Basic realm="Datasheet Extractor"/);
    expect(await response.text()).toMatch(/Sign in/);
  });

  it("answers API requests with the route error body", async () => {
    vi.stubEnv("APP_BASIC_AUTH", "sam:secret");

    const response = proxy(request("/api/submissions/abc/pdf", basic("sam:wrong")));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/^Basic /);
    expect(await response.json()).toEqual({ code: "unknown", error: "Sign in to make changes." });
  });

  it("lets a request with the right login through", () => {
    vi.stubEnv("APP_BASIC_AUTH", "sam:secret");

    expect(passesThrough(proxy(request("/", basic("sam:secret"))))).toBe(true);
  });

  it("passes everything through when APP_BASIC_AUTH is unset, even on Vercel production", () => {
    vi.stubEnv("APP_BASIC_AUTH", "");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(passesThrough(proxy(request("/")))).toBe(true);
    expect(passesThrough(proxy(request("/api/submissions/abc/pdf")))).toBe(true);
  });
});
