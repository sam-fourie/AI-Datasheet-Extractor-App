import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type KbdProps = ComponentPropsWithoutRef<"kbd">;

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-border bg-surface-muted px-1 font-mono text-[11px] leading-none font-medium text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
