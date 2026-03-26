import type { ComponentPropsWithoutRef, HTMLInputTypeAttribute } from "react";

import { controlClassName, inputControlClassName } from "./control-styles";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  invalid?: boolean;
  type?: HTMLInputTypeAttribute;
};

export function TextField({
  className,
  invalid = false,
  type = "text",
  ...props
}: TextFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(inputControlClassName, className)}
      type={type}
    />
  );
}
