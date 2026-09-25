import type { ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

export type CardPadding = "none" | "md" | "lg";

export type CardProps = ComponentPropsWithoutRef<"div"> & {
  padding?: CardPadding;
};

const paddingClassNames: Record<CardPadding, string> = {
  none: "",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

/** One surface per region: white, hairline border, card shadow. Never nest. */
export function Card({ className, padding = "md", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface shadow-card",
        paddingClassNames[padding],
        className,
      )}
      {...props}
    />
  );
}
