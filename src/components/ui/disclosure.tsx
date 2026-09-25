import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "./cn";

export type DisclosureProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  summary: ReactNode;
};

/** Native `<details>` with a rotating chevron. */
export function Disclosure({
  children,
  className,
  contentClassName,
  defaultOpen = false,
  summary,
}: DisclosureProps) {
  return (
    <details
      className={cn("group/disclosure", className)}
      open={defaultOpen || undefined}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xs text-body font-medium text-text select-none pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-text-muted transition-transform duration-(--ui-duration-fast) ease-ui group-open/disclosure:rotate-90"
        />
        {summary}
      </summary>
      <div
        className={cn(
          "pt-2 pl-5 text-callout text-text-muted",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
