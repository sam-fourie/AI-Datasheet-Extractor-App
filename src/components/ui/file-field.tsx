import type { ComponentPropsWithRef } from "react";

import { controlClassName } from "./control-styles";

export type FileFieldProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  invalid?: boolean;
};

/** Legacy native file input. The new intake uses its own drop zone. */
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
        "h-9 overflow-hidden px-1.5 py-1 text-callout text-text-muted file:mr-3 file:h-7 file:cursor-pointer file:rounded-xs file:border-0 file:bg-surface-muted file:px-3 file:text-callout file:font-medium file:text-text hover:file:bg-surface-sunken pointer-coarse:h-11",
        className,
      )}
      type="file"
    />
  );
}
