import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
export type BadgeSize = "sm" | "md";

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  /** Leading 6 px dot in the tone colour. */
  dot?: boolean;
  icon?: ReactNode;
  size?: BadgeSize;
  tone?: BadgeTone;
};

const toneClassNames: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-text-muted",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

const dotClassNames: Record<BadgeTone, string> = {
  neutral: "bg-pending",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const sizeClassNames: Record<BadgeSize, string> = {
  sm: "h-5 px-1.5 gap-1 [&_svg]:size-3",
  md: "h-6 px-2 gap-1.5 [&_svg]:size-3.5",
};

/** Small status label: 12/500, sentence case, soft fill with tone text. */
export function Badge({
  children,
  className,
  dot = false,
  icon,
  size = "md",
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-xs text-caption font-medium whitespace-nowrap tabular-nums [&_svg]:shrink-0",
        sizeClassNames[size],
        toneClassNames[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-pill", dotClassNames[tone])}
        />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="flex">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
