import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type LabelProps = ComponentPropsWithoutRef<"label">;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-[0.95rem] font-medium tracking-[-0.01em] text-text",
        className,
      )}
      {...props}
    />
  );
}
