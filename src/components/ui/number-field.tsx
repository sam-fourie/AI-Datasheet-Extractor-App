import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import {
  controlClassName,
  inputControlClassName,
  type ControlSize,
} from "./control-styles";

export type NumberFieldProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  controlSize?: ControlSize;
  invalid?: boolean;
};

export function NumberField({
  className,
  controlSize = "md",
  inputMode,
  invalid = false,
  ...props
}: NumberFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        cn(inputControlClassName(controlSize), "tabular-nums"),
        className,
      )}
      inputMode={inputMode ?? "numeric"}
      type="number"
    />
  );
}
