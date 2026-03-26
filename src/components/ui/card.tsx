import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type CardProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface p-6 shadow-panel sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
