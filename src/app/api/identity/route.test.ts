import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  ACTOR_COOKIE_NAME,
  ACTOR_MAX_AGE_SECONDS,
  createUnlockToken,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";

import { POST } from "./route";

const UNLOCKED = `${UNLOCK_COOKIE_NAME}=${createUnlockToken()}`;

function save(
  fields: Record<string, string>,
  options: { cookie?: string; json?: boolean; origin?: string } = {},
) {
  const { cookie = UNLOCKED, json = true, origin = "http://localhost:3000" } = options;

  return POST(
    new NextRequest(`${origin}/api/identity`, {
      body: new URLSearchParams(fields),
      headers: { ...(json ? { accept: "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      method: "POST",
    }),
  );
}

describe("POST /api/identity", () => {
  it("saves the tidied name in a cookie and answers with next", async () => {
    const response = await save({ name: "  Sam   Fourie ", next: "/reports" });
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "/reports" });
    expect(cookie).toContain(`${ACTOR_COOKIE_NAME}=Sam%20Fourie`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain(`Max-Age=${ACTOR_MAX_AGE_SECONDS}`);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure over HTTPS", async () => {
    const response = await save({ name: "Sam" }, { origin: "https://datasheets.example" });

    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("rejects an empty name", async () => {
    const response = await save({ name: "   ", next: "/reports" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "invalid-name", error: "Enter your name." });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("needs the PIN first", async () => {
    const response = await save({ name: "Sam" }, { cookie: "" });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unknown", error: "Enter the PIN to continue." });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("redirects a plain form post, staying on the site", async () => {
    const saved = await save({ name: "Sam", next: "//evil.example/" }, { json: false });
    const empty = await save({ name: "", next: "/reports" }, { json: false });

    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe("/");
    expect(empty.headers.get("location")).toBe("/unlock?next=%2Freports");
  });
});
