import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "./cn";

export type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
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
        "ui-checkbox mt-0.5 size-4 shrink-0 appearance-none rounded-[4px] border border-control-border bg-surface bg-center bg-no-repeat transition-colors duration-(--ui-duration-fast) ease-ui checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent hover:border-text-muted checked:hover:border-accent-strong checked:hover:bg-accent-strong disabled:border-border-strong disabled:bg-surface-muted disabled:checked:bg-pending",
        invalid && "border-danger",
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
        "flex cursor-pointer items-start gap-2.5 text-body pointer-coarse:min-h-11 pointer-coarse:items-center",
        disabled && "cursor-not-allowed",
      )}
    >
      {control}
      <span className={cn("min-w-0 space-y-0.5", disabled && "opacity-60")}>
        {label ? (
          <span className="block font-medium text-text">{label}</span>
        ) : null}
        {hint ? (
          <span className="block text-callout text-text-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
