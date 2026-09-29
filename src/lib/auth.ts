import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { normalizeActorName } from "@/lib/identity";

/**
 * The access gate: one shared PIN, hardcoded here on purpose (no environment
 * variable). Entering it on the PIN screen (/unlock) sets an HttpOnly unlock
 * cookie. The cookie's value is derived from the PIN, so it can't be forged
 * without knowing the PIN, and changing the PIN signs everyone out.
 *
 * - `src/proxy.ts` checks the cookie on every page and API request: locked
 *   page visits go to the PIN screen and locked API calls get a 401.
 * - `requireAuthorizedRequest` in `src/app/api/_lib/access.ts` checks it again
 *   in every route handler except `/api/unlock`, `/api/identity` and
 *   `/api/logout`.
 *
 * After the PIN, people say who they are ("Who is this?"). The name lives in
 * the `dx_name` cookie and is recorded on the submissions and reviews they
 * make (`readActorName`). Pages and API calls need both cookies.
 *
 * Server-only: this module uses `node:crypto`, so client components must not
 * import it.
 */
export const APP_PIN = "0000";

export const UNLOCK_COOKIE_NAME = "dx_unlock";
/** How long one unlock lasts: 30 days. */
export const UNLOCK_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const UNLOCK_PAGE_PATH = "/unlock";
export const UNLOCK_API_PATH = "/api/unlock";
/** Saves the name from the "Who is this?" step. Needs the unlock cookie. */
export const IDENTITY_API_PATH = "/api/identity";
/** Clears both cookies and returns to the PIN screen. Always reachable. */
export const LOGOUT_API_PATH = "/api/logout";
/** The `error` of a locked API call's 401 body. */
export const LOCKED_MESSAGE = "Enter the PIN to continue.";
/** The `error` of a 401 for an unlocked request with no name yet. */
export const UNNAMED_MESSAGE = "Enter your name to continue.";

export const ACTOR_COOKIE_NAME = "dx_name";
/** How long a device remembers the name: a year, or until Log out. */
export const ACTOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UNLOCK_TOKEN_CONTEXT = "ai-datasheet-extractor:unlock:v1";
const MAX_NEXT_PATH_LENGTH = 2048;
const PLACEHOLDER_ORIGIN = "http://unlock.invalid";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time string comparison (hashing first equalises the lengths). */
function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

/** Whether a submitted PIN matches `APP_PIN`, ignoring surrounding spaces. */
export function isCorrectPin(value: unknown): boolean {
  return typeof value === "string" && safeEqual(value.trim(), APP_PIN);
}

/** The unlock cookie's value for a PIN (an HMAC keyed by the PIN). */
export function createUnlockToken(pin: string = APP_PIN) {
  return createHmac("sha256", pin).update(UNLOCK_TOKEN_CONTEXT).digest("base64url");
}

/** Whether a cookie value is the current unlock token. */
export function isUnlockToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0 && safeEqual(value, createUnlockToken());
}

/**
 * One cookie's value from a `Cookie` request header, or null. When the name
 * repeats, the last value wins, as in Next's `request.cookies`, so the proxy
 * and the route handlers always read the same value.
 */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  let value: string | null = null;

  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");

    if (separator === -1 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    const raw = part.slice(separator + 1).trim();

    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
  }

  return value;
}

/** Whether a request carries a valid unlock cookie. */
export function isRequestUnlocked(request: Request): boolean {
  return isUnlockToken(readCookie(request.headers.get("cookie"), UNLOCK_COOKIE_NAME));
}

/** The name of whoever sent the request (the `dx_name` cookie), or null. */
export function readActorName(request: Request): string | null {
  return normalizeActorName(readCookie(request.headers.get("cookie"), ACTOR_COOKIE_NAME));
}

/**
 * Where to go after unlocking: a same-origin path with its query, or "/".
 * Rejects anything that could leave the site ("//host", "/\host", absolute
 * URLs) and the sign-in screen and its routes, and drops Next's internal
 * `_rsc` parameter.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > MAX_NEXT_PATH_LENGTH) {
    return "/";
  }

  let url: URL;

  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return "/";
  }

  if (
    url.origin !== PLACEHOLDER_ORIGIN ||
    [UNLOCK_PAGE_PATH, UNLOCK_API_PATH, IDENTITY_API_PATH, LOGOUT_API_PATH].includes(url.pathname)
  ) {
    return "/";
  }

  url.searchParams.delete("_rsc");

  return `${url.pathname}${url.search}`;
}

/** The PIN screen's href, remembering where to go next and whether the last try failed. */
export function buildUnlockHref(options: { failed?: boolean; next?: string } = {}) {
  const params = new URLSearchParams();
  const next = safeNextPath(options.next);

  if (options.failed) {
    params.set("error", "1");
  }

  if (next !== "/") {
    params.set("next", next);
  }

  const query = params.toString();

  return query ? `${UNLOCK_PAGE_PATH}?${query}` : UNLOCK_PAGE_PATH;
}

export type AccessRequest = {
  method: string;
  /** A top-level browser navigation (`Sec-Fetch-Mode: navigate`). */
  navigation: boolean;
  pathname: string;
  /** The query string with its leading "?", or "". */
  search: string;
  /** Whether the request carries a name (the `dx_name` cookie). */
  named: boolean;
  /** Whether the request carries a valid unlock cookie. */
  unlocked: boolean;
};

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "deny"; message: string }
  | { kind: "redirect"; location: string };

/**
 * The proxy's rule for one request. "Signed in" means both the unlock cookie
 * and a name.
 * - `/api/unlock` and `/api/logout` are always reachable, and `/api/identity`
 *   once unlocked.
 * - The PIN screen is reachable until signed in, and then skips ahead to its
 *   `next` path. It shows the PIN step, or the name step once unlocked.
 * - Signed-in requests pass.
 * - Other page loads, and browser navigations to an API URL (a PDF link
 *   opened in a new tab), redirect to the PIN screen with `next` set.
 * - Every other request is denied (the proxy answers 401 with the message).
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const { method, named, navigation, pathname, search, unlocked } = request;

  if (pathname === UNLOCK_API_PATH || pathname === LOGOUT_API_PATH) {
    return { kind: "allow" };
  }

  if (pathname === IDENTITY_API_PATH) {
    return unlocked ? { kind: "allow" } : { kind: "deny", message: LOCKED_MESSAGE };
  }

  if (pathname === UNLOCK_PAGE_PATH) {
    return unlocked && named
      ? { kind: "redirect", location: safeNextPath(new URLSearchParams(search).get("next")) }
      : { kind: "allow" };
  }

  if (unlocked && named) {
    return { kind: "allow" };
  }

  const readOnly = method === "GET" || method === "HEAD";
  const api = pathname === "/api" || pathname.startsWith("/api/");

  if (readOnly && (!api || navigation)) {
    return { kind: "redirect", location: buildUnlockHref({ next: `${pathname}${search}` }) };
  }

  return { kind: "deny", message: unlocked ? UNNAMED_MESSAGE : LOCKED_MESSAGE };
}
