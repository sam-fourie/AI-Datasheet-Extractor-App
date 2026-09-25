"use client";

import { useState, useSyncExternalStore } from "react";

import type { SubmissionHumanReview } from "@/lib/submissions/types";

/*
 * Browser storage and media helpers for the review workspace. Every storage
 * access is wrapped in try/catch (private mode, blocked storage), and every
 * value is read through useSyncExternalStore so the server render and the
 * first client render agree (no hydration mismatch, no setState in effects).
 */

/* --------------------------------- Keys ----------------------------------- */

export const STORAGE_KEYS = {
  autoAdvance: "review:auto-advance",
  followSelection: "review:follow-selection",
  pdfOpen: "review:pdf-open",
  /** Letter-key shortcuts (J, K, C, X, U, E, …); ⌘/Ctrl combinations always work. */
  singleKeyShortcuts: "review:single-key-shortcuts",
} as const;

/** sessionStorage key written by the intake on success (addendum A). */
export const ARRIVAL_KEY_PREFIX = "review:arrival:";

/** sessionStorage key the submissions list writes (serialized query, no "?"). */
export const LIST_QUERY_KEY = "submissions:lastQuery";

const DRAFT_MIRROR_PREFIX = "review:draft:";

/* ----------------------------- Safe accessors ------------------------------ */

function getLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readLocal(key: string): string | null {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string) {
  try {
    getLocalStorage()?.setItem(key, value);
  } catch {
    // Storage full or blocked: the preference or mirror just isn't kept.
  }
}

export function removeLocal(key: string) {
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    // Ignore.
  }
}

function listLocalKeys(prefix: string): string[] {
  try {
    const storage = getLocalStorage();

    if (!storage) {
      return [];
    }

    const keys: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }

    return keys;
  } catch {
    return [];
  }
}

export function readSession(key: string): string | null {
  try {
    return getSessionStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function removeSession(key: string) {
  try {
    getSessionStorage()?.removeItem(key);
  } catch {
    // Ignore.
  }
}

/* ------------------------ Stored boolean preferences ----------------------- */

const preferenceListeners = new Set<() => void>();

function subscribePreferences(listener: () => void) {
  preferenceListeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith("review:")) {
      listener();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyPreferences() {
  preferenceListeners.forEach((listener) => listener());
}

/**
 * A boolean preference in localStorage ("1" / "0"). The server render and
 * hydration use `defaultValue`; the stored value applies right after.
 */
export function useStoredBoolean(
  key: string,
  defaultValue: boolean,
): [boolean, (next: boolean) => void] {
  const raw = useSyncExternalStore(
    subscribePreferences,
    () => readLocal(key),
    () => null,
  );
  const value = raw === "1" ? true : raw === "0" ? false : defaultValue;

  function setValue(next: boolean) {
    writeLocal(key, next ? "1" : "0");
    notifyPreferences();
  }

  return [value, setValue];
}

/* ------------------------------ Media queries ------------------------------ */

/** matchMedia as a hook. `serverValue` is used for the server render and hydration. */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);

      media.addEventListener("change", listener);

      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/* --------------------------- One-shot client reads ------------------------- */

const onceCache = new WeakMap<object, { value: unknown }>();

function subscribeNever() {
  return () => {};
}

/**
 * Reads a browser-only value once per mount, after hydration (the server
 * render and hydration see `serverValue`). `read` may have side effects, such
 * as removing a sessionStorage key: it runs at most once per mount.
 */
export function useMountValue<T>(read: () => T, serverValue: T): T {
  const [token] = useState(() => ({}));

  return useSyncExternalStore(
    subscribeNever,
    () => {
      let cell = onceCache.get(token);

      if (!cell) {
        cell = { value: read() };
        onceCache.set(token, cell);
      }

      return cell.value as T;
    },
    () => serverValue,
  );
}

/* ----------------------------- Draft mirror -------------------------------- */

export type DraftMirror = {
  review: SubmissionHumanReview;
  /** Epoch ms of the last write. */
  savedAt: number;
};

/** `review:draft:{submissionId}:{savedUpdatedAt}` (addendum S). */
export function draftMirrorKey(submissionId: string, savedUpdatedAt: string) {
  return `${DRAFT_MIRROR_PREFIX}${submissionId}:${savedUpdatedAt}`;
}

function isReviewLike(value: unknown): value is SubmissionHumanReview {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.measurements) &&
    Array.isArray(record.pins) &&
    typeof record.reviewerNotes === "string" &&
    Boolean(record.packageSelection) &&
    typeof record.packageSelection === "object"
  );
}

/**
 * Deletes mirrors of this submission saved against an older `updatedAt` and
 * returns the mirror for the current one, if any.
 */
export function takeDraftMirror(
  submissionId: string,
  savedUpdatedAt: string,
): DraftMirror | null {
  const currentKey = draftMirrorKey(submissionId, savedUpdatedAt);

  for (const key of listLocalKeys(`${DRAFT_MIRROR_PREFIX}${submissionId}:`)) {
    if (key !== currentKey) {
      removeLocal(key);
    }
  }

  const raw = readLocal(currentKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DraftMirror>;

    if (isReviewLike(parsed.review) && typeof parsed.savedAt === "number") {
      return { review: parsed.review, savedAt: parsed.savedAt };
    }
  } catch {
    // Corrupt mirror: drop it below.
  }

  removeLocal(currentKey);

  return null;
}

export function writeDraftMirror(
  submissionId: string,
  savedUpdatedAt: string,
  review: SubmissionHumanReview,
) {
  const mirror: DraftMirror = { review, savedAt: Date.now() };

  writeLocal(draftMirrorKey(submissionId, savedUpdatedAt), JSON.stringify(mirror));
}

/** Removes every mirror of this submission (Save, Discard, guard "Discard changes"). */
export function clearDraftMirrors(submissionId: string) {
  for (const key of listLocalKeys(`${DRAFT_MIRROR_PREFIX}${submissionId}:`)) {
    removeLocal(key);
  }
}
