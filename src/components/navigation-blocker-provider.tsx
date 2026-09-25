"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button, Dialog } from "@/components/ui";

/**
 * App-wide navigation guard (spec §3.4, addendum D).
 *
 * - `useNavigationGuard(guard)` registers a guard while `guard` is non-null.
 *   "navigation" guards intercept in-app links (AppLink), `navigate()` and the
 *   browser Back button with a confirm dialog. Every guard, of either level,
 *   arms `beforeunload`.
 * - `useNavigationGuardControls()` is the only way app code navigates
 *   programmatically: `navigate(href, { replace })` asks first when a
 *   navigation guard is active; `releaseAndReplace(href)` hands the guarded
 *   history entry over to a new route without asking.
 *
 * Back interception uses a sentinel history entry: while a navigation guard
 * is active the current URL is pushed once more, so Back pops the sentinel
 * instead of leaving the page.
 */

export type NavigationGuardLevel = "navigation" | "unload";

export type NavigationGuard = {
  /** "unload" = beforeunload only; in-app links are allowed. */
  level: NavigationGuardLevel;
  /** Dialog title (navigation level). */
  title: string;
  description: string;
  /** Defaults to "Stay". */
  stayLabel?: string;
  /** e.g. "Discard changes", "Cancel extraction". */
  leaveLabel: string;
  /** Runs before the navigation proceeds. */
  onLeave?: () => void;
  /**
   * Where Leave goes on a Back attempt when there is nothing behind the page
   * in this tab (opened in a new tab, from a bookmark or a shared link).
   * Defaults to the parent path, e.g. /submissions for /submissions/abc.
   */
  fallbackHref?: string;
};

export type NavigateOptions = { replace?: boolean };

export type NavigationGuardControls = {
  /** Navigates, asking first when a navigation-level guard is active. */
  navigate: (href: string, options?: NavigateOptions) => void;
  /**
   * Disarms the guards without popping the Back sentinel, then
   * `router.replace(href)`, so the new route takes over the sentinel's
   * history entry. Call it while your guard is still registered.
   */
  releaseAndReplace: (href: string) => void;
};

type GuardEntry = {
  guard: NavigationGuard;
  id: string;
  /** New on every registration, so a stale pending attempt never reopens. */
  token: number;
};

type PendingNavigation = { token: number } & (
  | { kind: "href"; href: string; replace: boolean }
  | { kind: "back" }
);

type NavigationGuardContextValue = NavigationGuardControls & {
  interceptNavigation: (href: string, options?: NavigateOptions) => boolean;
  register: (id: string, guard: NavigationGuard) => void;
  unregister: (id: string) => void;
};

const SENTINEL_HISTORY_STATE_KEY = "__navigationGuardSentinel";

/**
 * How long a Leave on a Back attempt waits for `history.back()` to show any
 * sign of happening (popstate, beforeunload, pagehide) before it treats the
 * Back as a no-op, i.e. the page is the tab's first history entry.
 */
const BACK_WATCHDOG_MS = 500;

const NavigationGuardContext =
  createContext<NavigationGuardContextValue | null>(null);

function hasSentinelHistoryState(historyState: unknown) {
  if (!historyState || typeof historyState !== "object") {
    return false;
  }

  return Boolean(
    (historyState as Record<string, unknown>)[SENTINEL_HISTORY_STATE_KEY],
  );
}

function toSentinelHistoryState(historyState: unknown) {
  if (historyState && typeof historyState === "object") {
    return {
      ...(historyState as Record<string, unknown>),
      [SENTINEL_HISTORY_STATE_KEY]: true,
    };
  }

  return { [SENTINEL_HISTORY_STATE_KEY]: true };
}

function pushSentinelEntry() {
  window.history.pushState(
    toSentinelHistoryState(window.history.state),
    "",
    window.location.href,
  );
}

/** "/submissions/abc" -> "/submissions"; "/reports" -> "/"; "/" -> "/". */
function getParentPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  const parent = trimmed.slice(0, trimmed.lastIndexOf("/"));

  return parent || "/";
}

function findActiveNavigationEntry(entries: GuardEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].guard.level === "navigation") {
      return entries[index];
    }
  }

  return null;
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [entries, setEntries] = useState<GuardEntry[]>([]);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const tokenRef = useRef(0);
  const activeEntryRef = useRef<GuardEntry | null>(null);
  const hasSentinelRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);
  const leavingRef = useRef(false);
  /** Token of the guard being left on purpose while `leavingRef` is set. */
  const leavingTokenRef = useRef<number | null>(null);
  const entriesRef = useRef<GuardEntry[]>([]);
  /** Scroll position to put back after the cleanup `history.back()`. */
  const restoreScrollRef = useRef<{ x: number; y: number } | null>(null);
  const backWatchdogRef = useRef<(() => void) | null>(null);

  const activeEntry = findActiveNavigationEntry(entries);
  const hasNavigationGuard = activeEntry !== null;
  const hasAnyGuard = entries.length > 0;
  const dialogEntry =
    pending && activeEntry && pending.token === activeEntry.token
      ? activeEntry
      : null;

  useEffect(() => {
    activeEntryRef.current = activeEntry;
    entriesRef.current = entries;
  }, [activeEntry, entries]);

  const register = useCallback((id: string, guard: NavigationGuard) => {
    tokenRef.current += 1;
    const token = tokenRef.current;

    setEntries((current) => [
      ...current.filter((entry) => entry.id !== id),
      { guard, id, token },
    ]);
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  // beforeunload is armed while any guard of either level is active.
  useEffect(() => {
    if (!hasAnyGuard) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // The user already confirmed Leave in the app dialog. Still ask when
      // another guard (e.g. a running background task) is registered.
      if (
        leavingRef.current &&
        entriesRef.current.every(
          (entry) => entry.token === leavingTokenRef.current,
        )
      ) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasAnyGuard]);

  // Arm the Back sentinel while a navigation guard is active; pop it when the
  // guard goes away, unless the guard is being left on purpose (Leave or
  // releaseAndReplace), where the next route takes over the entry instead.
  useEffect(() => {
    if (hasNavigationGuard) {
      if (
        leavingRef.current &&
        activeEntryRef.current?.token === leavingTokenRef.current
      ) {
        // The route is committing a Leave; the guard unregisters when its
        // page unmounts. Do not re-arm a sentinel on the destination entry.
        return;
      }

      leavingRef.current = false;
      leavingTokenRef.current = null;

      if (!hasSentinelHistoryState(window.history.state)) {
        pushSentinelEntry();
      }

      hasSentinelRef.current = true;
      return;
    }

    if (leavingRef.current) {
      leavingRef.current = false;
      leavingTokenRef.current = null;
      hasSentinelRef.current = false;
      return;
    }

    if (
      hasSentinelRef.current &&
      hasSentinelHistoryState(window.history.state)
    ) {
      // The traversal would restore the scroll position saved when the
      // sentinel was pushed (the first edit); keep the current one instead.
      restoreScrollRef.current = { x: window.scrollX, y: window.scrollY };
      ignoreNextPopStateRef.current = true;
      window.history.back();
    }

    hasSentinelRef.current = false;
  }, [hasNavigationGuard, pathname]);

  useEffect(() => {
    function handlePopState() {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        const position = restoreScrollRef.current;
        restoreScrollRef.current = null;

        if (position) {
          window.scrollTo(position.x, position.y);
          window.requestAnimationFrame(() => {
            window.scrollTo(position.x, position.y);
          });
        }

        return;
      }

      const entry = activeEntryRef.current;

      if (leavingRef.current || !entry) {
        return;
      }

      if (hasSentinelHistoryState(window.history.state)) {
        // Forward back onto the sentinel: the user is staying.
        hasSentinelRef.current = true;
        setPending((current) => (current?.kind === "back" ? null : current));
        return;
      }

      if (!hasSentinelRef.current) {
        // A second Back while the dialog is open: the user really is leaving.
        leavingRef.current = true;
        leavingTokenRef.current = entry.token;
        setPending(null);
        entry.guard.onLeave?.();
        return;
      }

      // The sentinel popped. Hold here and ask; Leave goes back once more.
      hasSentinelRef.current = false;
      setPending({ kind: "back", token: entry.token });
    }

    function handlePageShow(event: PageTransitionEvent) {
      // Restored from the back/forward cache after a Leave that fully unloaded.
      if (event.persisted) {
        leavingRef.current = false;
        leavingTokenRef.current = null;
        hasSentinelRef.current = hasSentinelHistoryState(window.history.state);
      }
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const performNavigation = useCallback(
    (href: string, replace: boolean) => {
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router],
  );

  const interceptNavigation = useCallback(
    (href: string, options?: NavigateOptions) => {
      const entry = activeEntryRef.current;

      if (!entry || leavingRef.current) {
        return false;
      }

      setPending({
        href,
        kind: "href",
        replace: Boolean(options?.replace),
        token: entry.token,
      });

      return true;
    },
    [],
  );

  const navigate = useCallback(
    (href: string, options?: NavigateOptions) => {
      if (interceptNavigation(href, options)) {
        return;
      }

      performNavigation(href, Boolean(options?.replace));
    },
    [interceptNavigation, performNavigation],
  );

  const releaseAndReplace = useCallback(
    (href: string) => {
      leavingRef.current = true;
      leavingTokenRef.current = activeEntryRef.current?.token ?? null;
      setPending(null);
      router.replace(href);
    },
    [router],
  );

  const contextValue = useMemo<NavigationGuardContextValue>(
    () => ({
      interceptNavigation,
      navigate,
      register,
      releaseAndReplace,
      unregister,
    }),
    [interceptNavigation, navigate, register, releaseAndReplace, unregister],
  );

  function handleStay() {
    const target = pending;
    setPending(null);

    if (
      target?.kind === "back" &&
      activeEntryRef.current &&
      !hasSentinelHistoryState(window.history.state)
    ) {
      pushSentinelEntry();
      hasSentinelRef.current = true;
    }
  }

  function handleLeave() {
    const target = pending;
    const entry = dialogEntry;
    setPending(null);

    if (!target || !entry) {
      return;
    }

    leavingRef.current = true;
    leavingTokenRef.current = entry.token;
    entry.guard.onLeave?.();

    if (target.kind === "href") {
      performNavigation(target.href, target.replace);
      return;
    }

    // The sentinel already popped; complete the user's Back.
    completeBack(entry);
  }

  /**
   * `history.back()` is a no-op when the guarded page is the tab's first
   * entry. Watch for any sign of the traversal; when none comes, leave to
   * the guard's fallback route instead so Leave never strands the page.
   */
  function completeBack(entry: GuardEntry) {
    backWatchdogRef.current?.();

    let happened = false;
    const markHappened = () => {
      happened = true;
    };
    const events = ["popstate", "beforeunload", "pagehide"] as const;

    function stopWatching() {
      window.clearTimeout(timer);
      events.forEach((type) => window.removeEventListener(type, markHappened));

      if (backWatchdogRef.current === stopWatching) {
        backWatchdogRef.current = null;
      }
    }

    events.forEach((type) => window.addEventListener(type, markHappened));
    const timer = window.setTimeout(() => {
      stopWatching();

      if (!happened) {
        leaveWithoutHistory(entry);
      }
    }, BACK_WATCHDOG_MS);
    backWatchdogRef.current = stopWatching;

    window.history.back();
  }

  function isLeaving(token: number) {
    return leavingRef.current && leavingTokenRef.current === token;
  }

  function leaveWithoutHistory(entry: GuardEntry) {
    if (!isLeaving(entry.token)) {
      return;
    }

    const currentPath = window.location.pathname;
    const fallbackHref = entry.guard.fallbackHref ?? getParentPath(currentPath);

    if (fallbackHref !== currentPath) {
      performNavigation(fallbackHref, true);
      return;
    }

    // Nowhere to go: stay, and re-arm once onLeave's state has settled.
    window.setTimeout(() => abandonLeave(entry.token), BACK_WATCHDOG_MS);
  }

  /** The Leave did not navigate: never leave the guard disarmed. */
  function abandonLeave(token: number) {
    if (!isLeaving(token)) {
      return;
    }

    leavingRef.current = false;
    leavingTokenRef.current = null;

    if (!activeEntryRef.current) {
      hasSentinelRef.current = false;
      return;
    }

    if (!hasSentinelHistoryState(window.history.state)) {
      pushSentinelEntry();
    }

    hasSentinelRef.current = true;
  }

  const dialogGuard = dialogEntry?.guard ?? null;

  return (
    <NavigationGuardContext.Provider value={contextValue}>
      {children}
      <Dialog
        description={dialogGuard?.description}
        footer={
          <>
            <Button onClick={handleStay} ref={stayButtonRef} variant="secondary">
              {dialogGuard?.stayLabel ?? "Stay"}
            </Button>
            <Button onClick={handleLeave} variant="danger">
              {dialogGuard?.leaveLabel ?? "Leave"}
            </Button>
          </>
        }
        initialFocusRef={stayButtonRef}
        onClose={handleStay}
        open={dialogGuard !== null}
        role="alertdialog"
        size="sm"
        title={dialogGuard?.title ?? ""}
      />
    </NavigationGuardContext.Provider>
  );
}

/**
 * Registers `guard` while it is non-null. Pass a new object freely: only its
 * level and copy re-register it; `onLeave` always calls the latest callback.
 */
export function useNavigationGuard(guard: NavigationGuard | null) {
  const context = useContext(NavigationGuardContext);
  const register = context?.register;
  const unregister = context?.unregister;
  const id = useId();
  const onLeaveRef = useRef<NavigationGuard["onLeave"]>(undefined);
  const isActive = guard !== null;
  const level = guard?.level ?? "navigation";
  const title = guard?.title ?? "";
  const description = guard?.description ?? "";
  const stayLabel = guard?.stayLabel;
  const leaveLabel = guard?.leaveLabel ?? "";
  const onLeave = guard?.onLeave;
  const fallbackHref = guard?.fallbackHref;

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!isActive || !register || !unregister) {
      return;
    }

    register(id, {
      description,
      fallbackHref,
      leaveLabel,
      level,
      onLeave: () => onLeaveRef.current?.(),
      stayLabel,
      title,
    });

    return () => {
      unregister(id);
    };
  }, [
    description,
    fallbackHref,
    id,
    isActive,
    leaveLabel,
    level,
    register,
    stayLabel,
    title,
    unregister,
  ]);
}

const fallbackControls: NavigationGuardControls = {
  navigate: (href, options) => {
    if (options?.replace) {
      window.location.replace(href);
    } else {
      window.location.assign(href);
    }
  },
  releaseAndReplace: (href) => {
    window.location.replace(href);
  },
};

/** `navigate` and `releaseAndReplace`. Stable across renders. */
export function useNavigationGuardControls(): NavigationGuardControls {
  const context = useContext(NavigationGuardContext);
  const navigate = context?.navigate;
  const releaseAndReplace = context?.releaseAndReplace;

  return useMemo(
    () =>
      navigate && releaseAndReplace
        ? { navigate, releaseAndReplace }
        : fallbackControls,
    [navigate, releaseAndReplace],
  );
}

/**
 * For AppLink: opens the guard dialog for `href` and returns true when a
 * navigation guard is active; returns false (let the link navigate) otherwise.
 */
export function useNavigationGuardInterceptor(): (
  href: string,
  options?: NavigateOptions,
) => boolean {
  const context = useContext(NavigationGuardContext);

  return context?.interceptNavigation ?? returnFalse;
}

function returnFalse() {
  return false;
}
