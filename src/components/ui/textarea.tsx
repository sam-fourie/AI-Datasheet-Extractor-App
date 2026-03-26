import type { ComponentPropsWithoutRef } from "react";

import { controlClassName, textAreaControlClassName } from "./control-styles";

export type TextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  invalid?: boolean;
};

export function Textarea({
  className,
  invalid = false,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(textAreaControlClassName, className)}
    />
  );
}
