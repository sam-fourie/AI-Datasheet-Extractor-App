import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "./cn";

export type SwitchProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
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
        "inline-flex cursor-pointer items-start gap-2.5 text-body pointer-coarse:min-h-11 pointer-coarse:items-center",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      <span className="relative mt-px inline-flex h-[18px] w-8 shrink-0 items-center pointer-coarse:mt-0">
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
            "absolute inset-0 rounded-pill bg-pending transition-colors duration-(--ui-duration) ease-ui peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-40",
            invalid && "ring-2 ring-danger",
          )}
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 size-3.5 rounded-pill bg-white shadow-xs transition-transform duration-(--ui-duration) ease-ui peer-checked:translate-x-3.5"
        />
      </span>
      {label || hint ? (
        <span className={cn("min-w-0 space-y-0.5", disabled && "opacity-60")}>
          {label ? (
            <span className="block font-medium text-text">{label}</span>
          ) : null}
          {hint ? (
            <span className="block text-callout text-text-muted">{hint}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
