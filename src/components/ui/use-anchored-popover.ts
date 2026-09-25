"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type ToggleEvent,
} from "react";

import { positionFloating, type FloatingAlign } from "./floating";

type AnchoredPopoverOptions = {
  align: FloatingAlign;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Wiring shared by Menu and Popover: a `popover="auto"` element (top layer,
 * light dismiss, Escape) positioned next to its trigger on open and while the
 * page scrolls or resizes.
 */
export function useAnchoredPopover({
  align,
  onOpenChange,
}: AnchoredPopoverOptions) {
  const popoverId = useId();
  const triggerWrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function getTrigger() {
    return triggerWrapperRef.current?.firstElementChild ?? null;
  }

  function reposition() {
    const trigger = getTrigger();
    const popover = popoverRef.current;

    if (trigger && popover) {
      positionFloating(trigger, popover, { align, side: "bottom" });
    }
  }

  function handleBeforeToggle(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState === "open") {
      // The popover is laid out right after this event; position it before
      // the first paint so it never flashes at its default spot.
      window.requestAnimationFrame(reposition);
    }
  }

  function handleToggle(event: ToggleEvent<HTMLDivElement>) {
    const nextOpen = event.newState === "open";

    if (nextOpen) {
      reposition();
    }

    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function close() {
    try {
      popoverRef.current?.hidePopover();
    } catch {
      // Already closed.
    }
  }

  function openPopover() {
    try {
      popoverRef.current?.showPopover();
    } catch {
      // Already open or disconnected.
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleViewportChange() {
      const trigger = triggerWrapperRef.current?.firstElementChild;
      const popover = popoverRef.current;

      if (trigger && popover) {
        positionFloating(trigger, popover, { align, side: "bottom" });
      }
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [align, open]);

  return {
    close,
    getTrigger,
    handleBeforeToggle,
    handleToggle,
    open,
    openPopover,
    popoverId,
    popoverRef: popoverRef as RefObject<HTMLDivElement>,
    triggerWrapperRef: triggerWrapperRef as RefObject<HTMLSpanElement>,
  };
}
