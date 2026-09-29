import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The access gate: one shared PIN, hardcoded here on purpose (no environment
 * variable). Entering it on the PIN screen (/unlock) sets an HttpOnly unlock
 * cookie. The cookie's value is derived from the PIN, so it can't be forged
 * without knowing the PIN, and changing the PIN signs everyone out.
 *
 * - `src/proxy.ts` checks the cookie on every page and API request: locked
 *   page visits go to the PIN screen and locked API calls get a 401.
 * - `requireAuthorizedRequest` in `src/app/api/_lib/access.ts` checks it again
 *   in every route handler except `/api/unlock`.
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
/** The `error` of a locked API call's 401 body. */
export const LOCKED_MESSAGE = "Enter the PIN to continue.";

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

/** One cookie's value from a `Cookie` request header, or null. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    const raw = part.slice(separator + 1).trim();

    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return null;
}

/** Whether a request carries a valid unlock cookie. */
export function isRequestUnlocked(request: Request): boolean {
  return isUnlockToken(readCookie(request.headers.get("cookie"), UNLOCK_COOKIE_NAME));
}

/**
 * Where to go after unlocking: a same-origin path with its query, or "/".
 * Rejects anything that could leave the site ("//host", "/\host", absolute
 * URLs) and paths back to the PIN screen, and drops Next's internal `_rsc`
 * parameter.
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
    url.pathname === UNLOCK_PAGE_PATH ||
    url.pathname === UNLOCK_API_PATH
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
  /** Whether the request carries a valid unlock cookie. */
  unlocked: boolean;
};

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "deny" }
  | { kind: "redirect"; location: string };

/**
 * The proxy's rule for one request.
 * - The PIN screen and `/api/unlock` are always reachable. An unlocked visit to
 *   the PIN screen skips ahead to its `next` path.
 * - Unlocked requests pass.
 * - Locked page loads, and locked browser navigations to an API URL (a PDF
 *   link opened in a new tab), redirect to the PIN screen with `next` set.
 * - Every other locked request is denied (the proxy answers 401).
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const { method, navigation, pathname, search, unlocked } = request;

  if (pathname === UNLOCK_API_PATH) {
    return { kind: "allow" };
  }

  if (pathname === UNLOCK_PAGE_PATH) {
    return unlocked
      ? { kind: "redirect", location: safeNextPath(new URLSearchParams(search).get("next")) }
      : { kind: "allow" };
  }

  if (unlocked) {
    return { kind: "allow" };
  }

  const readOnly = method === "GET" || method === "HEAD";
  const api = pathname === "/api" || pathname.startsWith("/api/");

  if (readOnly && (!api || navigation)) {
    return { kind: "redirect", location: buildUnlockHref({ next: `${pathname}${search}` }) };
  }

  return { kind: "deny" };
}
