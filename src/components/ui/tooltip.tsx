"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "./cn";
import {
  floatingBaseClassName,
  positionFloating,
  type FloatingSide,
} from "./floating";

const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 80;

export type TooltipProps = {
  /** One focusable element. Its own `aria-describedby` is kept. */
  children: ReactElement;
  content: ReactNode;
  /** Set when the child already carries the same text as its accessible name. */
  describeChild?: boolean;
  side?: FloatingSide;
};

/**
 * Hover and keyboard-focus tooltip. The child must be focusable. Shows after
 * 400 ms, hides on Escape, and stays open while the pointer is over it.
 *
 * The child is rendered untouched (it may come from a Server Component, where
 * cloning it would differ between the server and client renders); the
 * tooltip id is appended to the anchor's `aria-describedby` from an effect.
 */
export function Tooltip({
  children,
  content,
  describeChild = true,
  side = "top",
}: TooltipProps) {
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  function clearTimers() {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }

    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function getAnchor() {
    return wrapperRef.current?.firstElementChild ?? null;
  }

  function show() {
    const tooltip = tooltipRef.current;
    const anchor = getAnchor();

    if (!tooltip || !anchor || !anchor.isConnected) {
      return;
    }

    try {
      if (!tooltip.matches(":popover-open")) {
        tooltip.showPopover();
      }
    } catch {
      return;
    }

    positionFloating(anchor, tooltip, { align: "center", offset: 6, side });
  }

  function hide() {
    clearTimers();

    try {
      tooltipRef.current?.hidePopover();
    } catch {
      // Already hidden.
    }
  }

  function scheduleShow() {
    clearTimers();
    showTimer.current = window.setTimeout(show, SHOW_DELAY_MS);
  }

  function scheduleHide() {
    clearTimers();
    hideTimer.current = window.setTimeout(hide, HIDE_DELAY_MS);
  }

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!describeChild || !wrapper) {
      return;
    }

    let described: Element | null = null;

    function ensureDescribed() {
      const anchor = wrapper?.firstElementChild ?? null;

      if (described && described !== anchor) {
        removeToken(described, tooltipId);
      }

      described = anchor;

      if (anchor) {
        addToken(anchor, tooltipId);
      }
    }

    ensureDescribed();

    // React rewrites aria-describedby when the child's own prop changes, and
    // may swap the anchor element; put the token back in either case.
    const observer = new MutationObserver(ensureDescribed);
    observer.observe(wrapper, {
      attributeFilter: ["aria-describedby"],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();

      if (described) {
        removeToken(described, tooltipId);
      }
    };
  }, [describeChild, tooltipId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (showTimer.current !== null) {
        window.clearTimeout(showTimer.current);
        showTimer.current = null;
      }

      try {
        tooltipRef.current?.hidePopover();
      } catch {
        // Already hidden.
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (showTimer.current !== null) {
        window.clearTimeout(showTimer.current);
      }
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  return (
    <>
      <span
        className="contents"
        onBlur={hide}
        onFocus={(event) => {
          const target = event.target as HTMLElement;

          if (target.matches(":focus-visible")) {
            scheduleShow();
          }
        }}
        onPointerDown={hide}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") {
            scheduleShow();
          }
        }}
        onPointerLeave={scheduleHide}
        ref={wrapperRef}
      >
        {children}
      </span>
      <div
        className={cn(
          floatingBaseClassName,
          "pointer-events-auto z-50 max-w-64 rounded-xs bg-surface px-2 py-1 text-caption text-text shadow-overlay",
        )}
        id={tooltipId}
        onPointerEnter={clearTimers}
        onPointerLeave={scheduleHide}
        popover="manual"
        ref={tooltipRef}
        role="tooltip"
      >
        {content}
      </div>
    </>
  );
}

function readTokens(element: Element) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

function addToken(element: Element, token: string) {
  const tokens = readTokens(element);

  if (!tokens.includes(token)) {
    element.setAttribute("aria-describedby", [...tokens, token].join(" "));
  }
}

function removeToken(element: Element, token: string) {
  const tokens = readTokens(element);

  if (!tokens.includes(token)) {
    return;
  }

  const rest = tokens.filter((value) => value !== token);

  if (rest.length > 0) {
    element.setAttribute("aria-describedby", rest.join(" "));
  } else {
    element.removeAttribute("aria-describedby");
  }
}
