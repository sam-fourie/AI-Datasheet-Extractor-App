import type { ComponentPropsWithoutRef } from "react";

import { controlClassName } from "./control-styles";

export type FileFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  invalid?: boolean;
};

export function FileField({
  className,
  invalid = false,
  ...props
}: FileFieldProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        "h-11 overflow-hidden px-3 py-1.5 text-sm file:mr-3 file:h-8 file:cursor-pointer file:rounded-pill file:border-0 file:bg-accent-soft file:px-4 file:text-sm file:font-medium file:text-accent",
        className,
      )}
      type="file"
    />
  );
}
