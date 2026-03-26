import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

export type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  hint?: ReactNode;
  invalid?: boolean;
  label?: ReactNode;
};

export function Checkbox({
  className,
  disabled,
  hint,
  invalid = false,
  label,
  ...props
}: CheckboxProps) {
  const control = (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(
        "mt-0.5 size-5 rounded-[0.45rem] border border-border-strong bg-surface shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-70",
        invalid && "border-danger focus-visible:ring-danger-ring",
        className,
      )}
      disabled={disabled}
      type="checkbox"
    />
  );

  if (!label && !hint) {
    return control;
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 text-sm",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {control}
      <span className="space-y-1">
        {label ? (
          <span className="block font-medium tracking-[-0.01em] text-text">
            {label}
          </span>
        ) : null}
        {hint ? <span className="block text-text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
