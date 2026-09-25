import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import { controlClassName, textAreaControlClassName } from "./control-styles";

export type TextareaProps = ComponentPropsWithRef<"textarea"> & {
  /**
   * Grows with its content (CSS `field-sizing: content`, capped at 16 lines).
   * Browsers without support keep the manual resize handle.
   */
  autoGrow?: boolean;
  invalid?: boolean;
};

export function Textarea({
  autoGrow = false,
  className,
  invalid = false,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={controlClassName(
        cn(
          textAreaControlClassName,
          autoGrow && "[field-sizing:content] max-h-[calc(16*20px+18px)]",
        ),
        className,
      )}
    />
  );
}
