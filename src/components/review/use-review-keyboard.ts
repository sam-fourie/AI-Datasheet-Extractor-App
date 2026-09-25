"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

import type { ReviewMode } from "@/lib/submissions/review";

/**
 * Keyboard model of the review workspace (§5.7, addendum M).
 *
 * ⌘/Ctrl+S, ⌘/Ctrl+Z and Esc work anywhere in the workspace (header,
 * toolbar, values column, bottom bar) and on a page with nothing focused.
 * Single-key shortcuts are narrower, so a stray key or speech input on a
 * toolbar button never changes the review (WCAG 2.1.4):
 * - on a review row or a control inside one: every key;
 * - with nothing focused (body / main): navigation only (J, K, N, P, [, ],
 *   E, ?), never the decision keys C, X, U, Enter and Backspace;
 * - anywhere else (header and toolbar buttons): none;
 * - none at all while `singleKeyShortcuts` is off (the shortcuts dialog switch).
 * The datasheet pane and the app sidebar are out of scope. Shortcuts are
 * ignored in inputs, textareas, selects and contenteditable (except ⌘S),
 * inside menus and popovers, and while a dialog is open. The listener sits on
 * `window`, after React's and the SearchField's document listeners, so
 * anything they handled (preventDefault) is skipped.
 */
export type ReviewKeyHandlers = {
  /** C / Enter (then advance). */
  confirm: () => void;
  /** E: read mode -> edit mode. */
  enterEdit: () => void;
  /** Esc not handled by the editor or search: returns true when it did something. */
  escape: (target: Element | null) => boolean;
  /** X: open the correction editor. */
  incorrect: () => void;
  mode: ReviewMode;
  /** J / ↓ (1), K / ↑ (-1): next / previous visible row. */
  move: (direction: 1 | -1) => void;
  /** N (1) / Shift+N (-1): next / previous pending row. */
  nextPending: (direction: 1 | -1) => void;
  /** ?: shortcuts dialog. */
  openShortcuts: () => void;
  /** U / Backspace: back to pending. */
  pending: () => void;
  /** Read mode: a decision key was pressed ("Press E to edit this review"). */
  readOnlyHint: () => void;
  /** ⌘S / Ctrl+S. */
  save: () => void;
  /** False turns every single-key shortcut off (⌘/Ctrl combinations and Esc still work). */
  singleKeyShortcuts: boolean;
  /** P: show the datasheet at the active row's page. */
  showPdf: () => void;
  /** [ (-1) / ] (1): previous / next evidence page of the active row. */
  stepPage: (direction: 1 | -1) => void;
  /** ⌘Z / Ctrl+Z. */
  undo: () => void;
};

const TYPING_INPUT_TYPES = new Set([
  "",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

function isTypingTarget(element: Element | null) {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLInputElement) {
    return TYPING_INPUT_TYPES.has(element.type);
  }

  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

function isPageLevelTarget(element: Element | null) {
  return (
    !element ||
    element === document.body ||
    element === document.documentElement ||
    element.id === "main"
  );
}

function isInOverlay(element: Element | null) {
  return Boolean(element?.closest("[popover], [role='menu'], dialog"));
}

export function useReviewKeyboard(
  scopeRef: RefObject<HTMLElement | null>,
  handlers: ReviewKeyHandlers,
) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.altKey) {
      return;
    }

    if (document.querySelector("dialog[open]")) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const scope = scopeRef.current;
    const inScope =
      isPageLevelTarget(target) ||
      Boolean(scope && target && scope.contains(target) && !target.closest("[data-review-pane]"));

    if (!inScope) {
      return;
    }

    const typing = isTypingTarget(target);
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;

    if (modifier) {
      if (lower === "s" && !event.shiftKey) {
        event.preventDefault();
        handlers.save();
      } else if (lower === "z" && !event.shiftKey && !typing && !isInOverlay(target)) {
        event.preventDefault();
        handlers.undo();
      }

      return;
    }

    if (key === "Escape") {
      if (handlers.escape(target)) {
        event.preventDefault();
      }

      return;
    }

    if (typing || isInOverlay(target)) {
      return;
    }

    const onRow = Boolean(target?.hasAttribute("data-row-key"));
    const inRows = Boolean(target?.closest("[data-row-key]"));
    const isReadMode = handlers.mode === "read";
    let handled = true;

    if (!handlers.singleKeyShortcuts || !(inRows || isPageLevelTarget(target))) {
      return;
    }

    switch (lower) {
      case "j":
        handlers.move(1);
        break;
      case "k":
        handlers.move(-1);
        break;
      case "ArrowDown":
      case "ArrowUp":
        if (!inRows) {
          handled = false;
          break;
        }

        handlers.move(key === "ArrowDown" ? 1 : -1);
        break;
      case "n":
        handlers.nextPending(event.shiftKey ? -1 : 1);
        break;
      case "c":
      case "x":
      case "u":
        // Decisions only with focus on a row, never from the bare page.
        if (!inRows) {
          handled = false;
          break;
        }

        if (isReadMode) {
          handlers.readOnlyHint();
        } else if (lower === "c") {
          handlers.confirm();
        } else if (lower === "x") {
          handlers.incorrect();
        } else {
          handlers.pending();
        }
        break;
      case "Enter":
      case "Backspace":
        if (!onRow) {
          handled = false;
          break;
        }

        if (isReadMode) {
          handlers.readOnlyHint();
        } else if (key === "Enter") {
          handlers.confirm();
        } else {
          handlers.pending();
        }
        break;
      case "[":
        handlers.stepPage(-1);
        break;
      case "]":
        handlers.stepPage(1);
        break;
      case "p":
        handlers.showPdf();
        break;
      case "e":
        if (isReadMode) {
          handlers.enterEdit();
        } else {
          handled = false;
        }
        break;
      case "?":
        handlers.openShortcuts();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    function listener(event: KeyboardEvent) {
      handleKeyDown(event);
    }

    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, []);
}
