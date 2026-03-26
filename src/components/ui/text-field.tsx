import type {
  ComponentPropsWithoutRef,
  HTMLInputTypeAttribute,
  ReactNode,
} from "react";

import { cn } from "./cn";
import { controlClassName, inputControlClassName } from "./control-styles";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  endAdornment?: ReactNode;
  invalid?: boolean;
  type?: HTMLInputTypeAttribute;
};

export function TextField({
  className,
  endAdornment,
  invalid = false,
  type = "text",
  ...props
}: TextFieldProps) {
  const input = (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        cn(inputControlClassName, endAdornment ? "pr-12" : undefined),
        className,
      )}
      type={type}
    />
  );

  if (!endAdornment) {
    return input;
  }

  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
        {endAdornment}
      </span>
    </div>
  );
}
