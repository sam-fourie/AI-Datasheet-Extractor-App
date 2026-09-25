import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "plain";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonStyleOptions = {
  className?: string;
  iconOnly?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

/**
 * `aria-disabled="true"` renders the disabled look and ignores clicks (no
 * submit either) but keeps the button focusable, so it can carry a Tooltip
 * explaining why it is unavailable. Prefer it over `disabled` whenever a
 * reason is shown.
 */
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  iconOnly?: boolean;
  /** Shows a spinner, sets aria-busy and ignores clicks while keeping focus. */
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseClassName =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border font-medium transition-[background-color,border-color,color] duration-(--ui-duration-fast) ease-ui disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:shrink-0";

/*
 * Every variant styles `:disabled` and `[aria-disabled="true"]` identically
 * (a loading button, which is aria-disabled and aria-busy, keeps its colors).
 * Both selectors are emitted after hover and active, so they also cancel the
 * hover and pressed tints.
 */
const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-white hover:bg-accent-strong active:bg-accent-strong disabled:bg-surface-muted disabled:text-text-tertiary aria-disabled:not-aria-busy:bg-surface-muted aria-disabled:not-aria-busy:text-text-tertiary",
  secondary:
    "border-border-strong bg-surface text-text hover:bg-surface-muted active:bg-surface-sunken disabled:bg-surface disabled:text-text-tertiary aria-disabled:not-aria-busy:bg-surface aria-disabled:not-aria-busy:text-text-tertiary",
  ghost:
    "border-transparent bg-transparent text-text-muted hover:bg-surface-hover hover:text-text active:bg-surface-muted disabled:bg-transparent disabled:text-text-tertiary aria-disabled:not-aria-busy:bg-transparent aria-disabled:not-aria-busy:text-text-tertiary",
  danger:
    "border-transparent bg-danger text-white hover:bg-danger-strong active:bg-danger-strong disabled:bg-surface-muted disabled:text-text-tertiary aria-disabled:not-aria-busy:bg-surface-muted aria-disabled:not-aria-busy:text-text-tertiary",
  plain:
    "border-transparent bg-transparent text-accent-text underline-offset-2 hover:underline disabled:text-text-tertiary disabled:no-underline aria-disabled:not-aria-busy:text-text-tertiary aria-disabled:not-aria-busy:no-underline",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-callout [&_svg]:size-3.5",
  md: "h-8 px-3 text-body [&_svg]:size-4",
  lg: "h-10 px-4 text-[15px] leading-5 [&_svg]:size-[18px]",
};

const iconOnlySizeClassNames: Record<ButtonSize, string> = {
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-8 [&_svg]:size-4",
  lg: "size-10 [&_svg]:size-[18px]",
};

const plainSizeClassNames: Record<ButtonSize, string> = {
  sm: "h-auto px-0 text-callout [&_svg]:size-3.5",
  md: "h-auto px-0 text-body [&_svg]:size-4",
  lg: "h-auto px-0 text-[15px] leading-5 [&_svg]:size-[18px]",
};

/** Class names for anything that should look like a button (links, triggers). */
export function buttonClassName({
  className,
  iconOnly = false,
  size = "md",
  variant = "primary",
}: ButtonStyleOptions = {}) {
  const sizeClassName =
    variant === "plain"
      ? plainSizeClassNames[size]
      : iconOnly
        ? cn(iconOnlySizeClassNames[size], "px-0 pointer-coarse:min-w-11")
        : sizeClassNames[size];

  return cn(
    baseClassName,
    sizeClassName,
    "pointer-coarse:min-h-11",
    variantClassNames[variant],
    className,
  );
}

export function Button({
  children,
  className,
  iconOnly = false,
  loading = false,
  onClick,
  size = "md",
  type,
  variant = "primary",
  ...props
}: ButtonProps) {
  // No wrapper handler, so the button stays renderable from Server
  // Components. While loading or aria-disabled, the click handler is dropped
  // and the type is forced to "button" so neither clicks nor Enter submit
  // anything, yet the button keeps focus (unlike `disabled`).
  const ariaDisabled = props["aria-disabled"];
  const inert = loading || ariaDisabled === true || ariaDisabled === "true";

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={inert || undefined}
      className={buttonClassName({ className, iconOnly, size, variant })}
      onClick={inert ? undefined : onClick}
      type={inert ? "button" : (type ?? "button")}
    >
      {loading ? <Spinner /> : null}
      {loading && iconOnly ? null : children}
    </button>
  );
}
