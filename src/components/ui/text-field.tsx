import type {
  ComponentPropsWithRef,
  HTMLInputTypeAttribute,
  ReactNode,
} from "react";

import { cn } from "./cn";
import {
  controlClassName,
  inputControlClassName,
  type ControlSize,
} from "./control-styles";

export type TextFieldProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  controlSize?: ControlSize;
  endAdornment?: ReactNode;
  invalid?: boolean;
  startAdornment?: ReactNode;
  type?: HTMLInputTypeAttribute;
};

export function TextField({
  className,
  controlSize = "md",
  endAdornment,
  invalid = false,
  startAdornment,
  type = "text",
  ...props
}: TextFieldProps) {
  const input = (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        cn(
          inputControlClassName(controlSize),
          startAdornment ? "pl-9" : undefined,
          endAdornment ? "pr-10" : undefined,
        ),
        className,
      )}
      type={type}
    />
  );

  if (!endAdornment && !startAdornment) {
    return input;
  }

  return (
    <div className="relative min-w-0">
      {startAdornment ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted [&_svg]:size-4">
          {startAdornment}
        </span>
      ) : null}
      {input}
      {endAdornment ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted">
          {endAdornment}
        </span>
      ) : null}
    </div>
  );
}
