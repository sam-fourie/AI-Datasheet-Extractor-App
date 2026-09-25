"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "./cn";
import { floatingBaseClassName, type FloatingAlign } from "./floating";
import { useAnchoredPopover } from "./use-anchored-popover";

type PopoverTriggerProps = {
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog";
  popoverTarget?: string;
};

export type PopoverProps = {
  align?: FloatingAlign;
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  className?: string;
  /** Accessible name. When set the panel is exposed as a non-modal dialog. */
  label?: string;
  onOpenChange?: (open: boolean) => void;
  trigger: ReactElement<PopoverTriggerProps>;
  /** Panel width in px, or "auto" to size to content. */
  width?: number | "auto";
};

/**
 * Anchored panel for arbitrary content (details, run switcher, filters). Uses
 * `popover="auto"`, so it sits in the top layer and closes on outside click
 * or Escape, returning focus to the trigger.
 */
export function Popover({
  align = "start",
  children,
  className,
  label,
  onOpenChange,
  trigger,
  width = 320,
}: PopoverProps) {
  const {
    close,
    handleBeforeToggle,
    handleToggle,
    open,
    popoverId,
    popoverRef,
    triggerWrapperRef,
  } = useAnchoredPopover({ align, onOpenChange });

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        "aria-controls": popoverId,
        "aria-expanded": open,
        "aria-haspopup": label ? "dialog" : undefined,
        popoverTarget: popoverId,
      })
    : trigger;

  return (
    <>
      <span className="contents" ref={triggerWrapperRef}>
        {triggerElement}
      </span>
      <div
        aria-label={label}
        className={cn(
          floatingBaseClassName,
          "z-50 max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md bg-surface p-4 shadow-overlay motion-safe:open:animate-float-in",
          className,
        )}
        id={popoverId}
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
        popover="auto"
        ref={popoverRef}
        role={label ? "dialog" : undefined}
        style={{ width: width === "auto" ? undefined : width }}
      >
        {typeof children === "function" ? children({ close }) : children}
      </div>
    </>
  );
}
