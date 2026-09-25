import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type LabelProps = ComponentPropsWithoutRef<"label">;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("block text-callout font-medium text-text", className)}
      {...props}
    />
  );
}
