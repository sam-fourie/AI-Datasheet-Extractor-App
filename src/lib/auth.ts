import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared access gate: the authoritative check in mutating API route handlers
 * (src/app/api/_lib/access.ts) and the optimistic page-level check in
 * src/proxy.ts.
 *
 * `APP_BASIC_AUTH` holds `username:password`. When it is set, every gated
 * request must carry a matching HTTP Basic `Authorization` header. Browsers
 * prompt for the credentials on the first 401 (the response carries a
 * `WWW-Authenticate` challenge) and then resend them on every same-origin
 * request, so the client code needs no changes.
 *
 * The gate is opt-in: when `APP_BASIC_AUTH` is not set, every request is
 * allowed, so deploying this code never locks anyone out. Set it in Vercel
 * (Production and Preview) to require the login on the public domain.
 */
export const ACCESS_ENV_VAR = "APP_BASIC_AUTH";

const REALM = "Datasheet Extractor";

/** The `WWW-Authenticate` value that makes the browser ask for the login. */
export const BASIC_AUTH_CHALLENGE = `Basic realm="${REALM}", charset="UTF-8"`;

export type AccessEnv = {
  /** Value of `APP_BASIC_AUTH` (`username:password`). */
  credentials?: string;
};

export type AccessDecision =
  | { ok: true }
  | {
      /** True when the response should carry a Basic auth challenge. */
      challenge: boolean;
      message: string;
      ok: false;
      status: 401 | 503;
    };

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time string comparison (hashing first equalises the lengths). */
function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

/** Returns `username:password` from a Basic `Authorization` header, or null. */
export function parseBasicAuthorization(header: string | null | undefined) {
  if (!header) {
    return null;
  }

  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header.trim());

  if (!match) {
    return null;
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf8");

  return decoded.includes(":") ? decoded : null;
}

/** Pure decision for a request's `Authorization` header against the env. */
export function checkAccess(
  authorizationHeader: string | null | undefined,
  env: AccessEnv,
): AccessDecision {
  const expected = env.credentials?.trim();

  if (!expected) {
    return { ok: true };
  }

  if (!expected.includes(":")) {
    return {
      challenge: false,
      message: `${ACCESS_ENV_VAR} must be set as "username:password".`,
      ok: false,
      status: 503,
    };
  }

  const provided = parseBasicAuthorization(authorizationHeader);

  if (provided !== null && safeEqual(provided, expected)) {
    return { ok: true };
  }

  return {
    challenge: true,
    message: "Sign in to make changes.",
    ok: false,
    status: 401,
  };
}

/** `checkAccess` against this server's environment. */
export function checkRequestAccess(authorizationHeader: string | null | undefined) {
  return checkAccess(authorizationHeader, {
    credentials: process.env[ACCESS_ENV_VAR],
  });
}
