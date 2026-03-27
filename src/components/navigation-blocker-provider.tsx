"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button, Card } from "@/components/ui";

const SENTINEL_HISTORY_STATE_KEY = "__navigationBlockerSentinel";

type NavigationBlockerContextValue = {
  isBlocked: boolean;
  notifyBlockedNavigationAttempt: () => void;
  setIsBlocked: (nextIsBlocked: boolean) => void;
};

const NavigationBlockerContext =
  createContext<NavigationBlockerContextValue | null>(null);

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

  return {
    [SENTINEL_HISTORY_STATE_KEY]: true,
  };
}

export function NavigationBlockerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isBlocked, setBlockedState] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasSentinelEntryRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);
  const descriptionId = useId();
  const titleId = useId();

  const setIsBlocked = useCallback((nextIsBlocked: boolean) => {
    setBlockedState(nextIsBlocked);

    if (!nextIsBlocked) {
      setIsDialogOpen(false);
    }
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const notifyBlockedNavigationAttempt = useCallback(() => {
    if (!isBlocked) {
      return;
    }

    setIsDialogOpen(true);
  }, [isBlocked]);

  useEffect(() => {
    if (!isBlocked) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isBlocked]);

  useEffect(() => {
    if (!isBlocked) {
      if (
        hasSentinelEntryRef.current &&
        hasSentinelHistoryState(window.history.state)
      ) {
        ignoreNextPopStateRef.current = true;
        window.history.back();
      }

      hasSentinelEntryRef.current = false;
      return;
    }

    if (!hasSentinelHistoryState(window.history.state)) {
      window.history.pushState(
        toSentinelHistoryState(window.history.state),
        "",
        window.location.href,
      );
    }

    hasSentinelEntryRef.current = true;

    function handlePopState() {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }

      notifyBlockedNavigationAttempt();
      window.history.pushState(
        toSentinelHistoryState(window.history.state),
        "",
        window.location.href,
      );
      hasSentinelEntryRef.current = true;
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isBlocked, notifyBlockedNavigationAttempt]);

  return (
    <NavigationBlockerContext.Provider
      value={{
        isBlocked,
        notifyBlockedNavigationAttempt,
        setIsBlocked,
      }}
    >
      {children}

      {isDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6 py-8 backdrop-blur-sm">
          <Card
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="w-full max-w-lg space-y-5"
            role="alertdialog"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                Extraction in progress
              </p>
              <h2 id={titleId} className="text-2xl">
                Please wait for the current extraction to finish
              </h2>
              <p
                id={descriptionId}
                className="text-sm leading-6 text-text-muted"
              >
                Leaving this page before the AI request finishes may cause you
                to lose the live extraction output. Stay on this page until the
                current extraction is complete.
              </p>
            </div>

            <div className="flex justify-end">
              <Button autoFocus onClick={closeDialog} variant="secondary">
                OK
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </NavigationBlockerContext.Provider>
  );
}

export function useNavigationBlocker() {
  const context = useContext(NavigationBlockerContext);

  if (!context) {
    throw new Error(
      "useNavigationBlocker must be used within a NavigationBlockerProvider.",
    );
  }

  return context;
}
