"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { cn } from "./cn";

export type SegmentedControlOption<T extends string = string> = {
  count?: number;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  value: T;
};

export type SegmentedControlProps<T extends string = string> = {
  "aria-label": string;
  className?: string;
  /** Uncontrolled initial value (for plain GET forms). */
  defaultValue?: T;
  fullWidth?: boolean;
  name?: string;
  onChange?: (value: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "sm" | "md";
  value?: T;
};

const sizeClassNames = {
  sm: "h-7 text-callout",
  md: "h-8 text-body",
} as const;

/**
 * Single-choice segmented control built on visually hidden native radios, so
 * arrow keys and radiogroup semantics come from the browser. The white thumb
 * slides between segments (instantly under reduced motion).
 */
export function SegmentedControl<T extends string = string>({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  fullWidth = false,
  name,
  onChange,
  options,
  size = "md",
  value,
}: SegmentedControlProps<T>) {
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const hasPositioned = useRef(false);

  function positionThumb() {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const checked = track?.querySelector<HTMLInputElement>("input:checked");
    const segment = checked?.nextElementSibling as
      HTMLElement | null | undefined;

    if (!track || !thumb) {
      return;
    }

    if (!segment) {
      thumb.style.opacity = "0";
      return;
    }

    thumb.style.transition = hasPositioned.current
      ? "transform 150ms var(--ui-ease), width 150ms var(--ui-ease)"
      : "none";
    const trackRect = track.getBoundingClientRect();
    const segmentRect = segment.getBoundingClientRect();
    thumb.style.width = `${segmentRect.width}px`;
    thumb.style.transform = `translateX(${segmentRect.left - trackRect.left - track.clientLeft}px)`;
    thumb.style.opacity = "1";
    track.dataset.ready = "true";
    hasPositioned.current = true;
  }

  useLayoutEffect(() => {
    positionThumb();

    const track = trackRef.current;

    if (!track || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      const thumb = thumbRef.current;
      const previous = thumb?.style.transition;

      if (thumb) {
        thumb.style.transition = "none";
      }

      positionThumb();

      if (thumb && previous) {
        thumb.style.transition = previous;
      }
    });

    observer.observe(track);

    return () => observer.disconnect();
    // positionThumb reads the DOM only; re-run when the selection changes.
  }, [value, options.length]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    positionThumb();
    onChange?.(event.target.value as T);
  }

  return (
    <div
      className={cn(
        "max-w-full overflow-x-auto [scrollbar-width:none]",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      <div
        aria-label={ariaLabel}
        className={cn(
          "group/segmented relative isolate flex shrink-0 items-stretch rounded-sm bg-surface-muted p-0.5",
          fullWidth && "w-full",
        )}
        ref={trackRef}
        role="radiogroup"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 -z-10 rounded-xs bg-surface opacity-0 shadow-xs"
          ref={thumbRef}
        />
        {options.map((option) => {
          const isControlled = value !== undefined;

          return (
            <label
              className={cn("relative flex", fullWidth && "flex-1")}
              key={option.value}
            >
              <input
                checked={isControlled ? option.value === value : undefined}
                className="peer sr-only"
                defaultChecked={
                  isControlled ? undefined : option.value === defaultValue
                }
                disabled={option.disabled}
                name={groupName}
                onChange={handleChange}
                type="radio"
                value={option.value}
              />
              <span
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-1 rounded-xs px-2 font-medium sm:gap-1.5 sm:px-3 whitespace-nowrap text-text-muted transition-colors duration-(--ui-duration-fast) ease-ui select-none hover:text-text peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-0 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:text-text-tertiary pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0",
                  "peer-checked:bg-surface peer-checked:shadow-xs group-data-[ready=true]/segmented:peer-checked:bg-transparent group-data-[ready=true]/segmented:peer-checked:shadow-none",
                  sizeClassNames[size],
                )}
              >
                {option.icon ? (
                  <span aria-hidden="true" className="flex">
                    {option.icon}
                  </span>
                ) : null}
                {option.label}
                {option.count !== undefined ? (
                  <span className="text-caption font-normal text-text-muted tabular-nums">
                    {option.count}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
