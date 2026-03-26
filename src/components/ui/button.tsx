import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-white shadow-soft hover:bg-accent-strong active:translate-y-px",
  secondary:
    "bg-surface text-text shadow-soft hover:border-border-strong hover:bg-surface-muted active:translate-y-px",
  ghost:
    "border-transparent bg-transparent text-text-muted shadow-none hover:bg-surface-muted hover:text-text active:translate-y-px",
  danger:
    "border-transparent bg-danger text-white shadow-soft hover:bg-danger-strong active:translate-y-px",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export function Button({
  className,
  size = "md",
  type,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill border font-medium tracking-[-0.01em] whitespace-nowrap transition duration-150 ease-out outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-60",
        sizeClassNames[size],
        variantClassNames[variant],
        className,
      )}
      type={type ?? "button"}
      {...props}
    />
  );
}
