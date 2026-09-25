import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";

import { cn } from "./cn";

export type BreadcrumbItem = { href: string; label: string };

export type PageHeaderProps = {
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  className?: string;
  meta?: ReactNode;
  title: ReactNode;
};

/** Page title block on the page background: no band, border or tint. */
export function PageHeader({
  actions,
  breadcrumb,
  className,
  meta,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between lg:pt-8 lg:pb-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-callout text-text-muted">
              {breadcrumb.map((item, index) => (
                <li
                  className="flex items-center gap-1"
                  key={`${item.href}-${index}`}
                >
                  {index > 0 ? (
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  ) : null}
                  <AppLink
                    className="rounded-xs hover:text-text hover:underline"
                    href={item.href}
                  >
                    {item.label}
                  </AppLink>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className="text-title-1 break-words text-text">{title}</h1>
        {meta ? (
          <div className="text-callout text-text-muted">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
