import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { AppLink } from "@/components/app-link";

import { cn } from "./cn";
import { CopyButton } from "./copy-button";

export type DescriptionListItem = {
  /** Adds a copy button that copies this text. */
  copyValue?: string;
  /** Links the value. `http(s)` URLs open in a new tab. */
  href?: string;
  term: ReactNode;
  value: ReactNode;
};

export type DescriptionListProps = {
  className?: string;
  items: DescriptionListItem[];
  layout?: "stacked" | "columns";
};

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

export function DescriptionList({
  className,
  items,
  layout = "columns",
}: DescriptionListProps) {
  return (
    <dl
      className={cn(
        layout === "columns"
          ? "grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(7rem,max-content)_minmax(0,1fr)] sm:gap-y-3"
          : "flex flex-col gap-3",
        className,
      )}
    >
      {items.map((item, index) => {
        const value = item.href ? (
          isExternal(item.href) ? (
            <a
              className="inline-flex items-center gap-0.5 text-accent-text hover:underline"
              href={item.href}
              rel="noopener"
              target="_blank"
            >
              {item.value}
              <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          ) : (
            <AppLink
              className="text-accent-text hover:underline"
              href={item.href}
            >
              {item.value}
            </AppLink>
          )
        ) : (
          item.value
        );

        return (
          <div
            className={cn(
              layout === "columns" ? "contents" : "flex flex-col gap-0.5",
            )}
            key={index}
          >
            <dt
              className={cn(
                "text-callout text-text-muted",
                layout === "columns" && index > 0 && "pt-2 sm:pt-0",
              )}
            >
              {item.term}
            </dt>
            <dd className="flex min-w-0 items-center gap-1 text-body break-words text-text">
              <span className="min-w-0">{value}</span>
              {item.copyValue ? (
                <CopyButton
                  className="-my-1"
                  label="Copy value"
                  value={item.copyValue}
                />
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
