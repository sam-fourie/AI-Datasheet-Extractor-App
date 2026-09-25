import type { ReactNode } from "react";

import { cn } from "@/components/ui";

export type ReportSectionProps = {
  /** Right-aligned content in the heading row. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  id: string;
  title: ReactNode;
};

/**
 * One Reports section: a title-2 heading on the page background, an optional
 * muted line, then the section's single surface. `id` is the in-page anchor
 * (the run switcher links to `#matrix`); scroll margin clears the sticky
 * mobile top bar.
 */
export function ReportSection({
  action,
  children,
  className,
  description,
  id,
  title,
}: ReportSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 scroll-mt-[calc(var(--ui-topbar-height)+16px)] flex-col gap-4 lg:scroll-mt-6",
        className,
      )}
      id={id}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-title-2 text-text" id={headingId}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-callout text-text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type ChartCardHeaderProps = {
  action?: ReactNode;
  description?: ReactNode;
  id?: string;
  title: ReactNode;
};

/** Title row inside a chart card (h3 under the section's h2). */
export function ChartCardHeader({
  action,
  description,
  id,
  title,
}: ChartCardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h3 className="text-title-3 text-text" id={id}>
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-callout text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
