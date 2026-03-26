import type { ComponentPropsWithoutRef } from "react";

import { controlClassName, inputControlClassName } from "./control-styles";

export type NumberFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  invalid?: boolean;
};

export function NumberField({
  className,
  inputMode,
  invalid = false,
  ...props
}: NumberFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(inputControlClassName, className)}
      inputMode={inputMode ?? "numeric"}
      type="number"
    />
  );
}
