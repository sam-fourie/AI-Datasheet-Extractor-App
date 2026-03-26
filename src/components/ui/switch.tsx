import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  hint?: ReactNode;
  invalid?: boolean;
  label?: ReactNode;
};

export function Switch({
  className,
  disabled,
  hint,
  invalid = false,
  label,
  ...props
}: SwitchProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 text-sm",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center">
        <input
          {...props}
          aria-invalid={invalid || props["aria-invalid"]}
          className="peer sr-only"
          disabled={disabled}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-pill bg-[#d7dbe2] transition duration-200 ease-out peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-ring peer-disabled:bg-surface-muted",
            invalid && "peer-focus-visible:ring-danger-ring",
          )}
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 size-6 rounded-pill bg-white shadow-[0_1px_3px_rgba(15,23,42,0.22)] transition-transform duration-200 ease-out peer-checked:translate-x-5"
        />
      </span>
      {(label || hint) && (
        <span className="space-y-1">
          {label ? (
            <span className="block font-medium tracking-[-0.01em] text-text">
              {label}
            </span>
          ) : null}
          {hint ? <span className="block text-text-muted">{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
