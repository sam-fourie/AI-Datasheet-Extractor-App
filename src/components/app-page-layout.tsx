import type { ReactNode } from "react";

import { cn, PageHeader, type BreadcrumbItem } from "@/components/ui";

export type AppPageWidth = "narrow" | "default" | "full";

export type AppPageLayoutProps = {
  /** Right-aligned header actions. */
  action?: ReactNode;
  bodyClassName?: string;
  breadcrumb?: BreadcrumbItem[];
  children: ReactNode;
  /** Longer muted text under the title (below `meta` when both are set). */
  description?: ReactNode;
  /** Short muted line under the title, e.g. "13 submissions · 9 need review". */
  meta?: ReactNode;
  title: ReactNode;
  /** narrow = 640 px (intake), default = 1120 px, full = no max width. */
  width?: AppPageWidth;
};

const widthClassNames: Record<AppPageWidth, string> = {
  default: "max-w-(--ui-content-default)",
  full: "max-w-none",
  narrow: "max-w-(--ui-content-narrow)",
};

/** Page gutter and max width shared by every standard page. */
export function appPageContainerClassName(width: AppPageWidth = "default") {
  return cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widthClassNames[width]);
}

/**
 * Standard page frame: the page's single `<h1>` via `PageHeader`, then the
 * body. The review workspace does not use it.
 */
export function AppPageLayout({
  action,
  bodyClassName,
  breadcrumb,
  children,
  description,
  meta,
  title,
  width = "default",
}: AppPageLayoutProps) {
  const headerMeta =
    meta && description ? (
      <>
        <div>{meta}</div>
        <div className="mt-1 max-w-3xl">{description}</div>
      </>
    ) : (
      (meta ?? (description ? <div className="max-w-3xl">{description}</div> : null))
    );

  return (
    <div className={appPageContainerClassName(width)}>
      <PageHeader
        actions={action}
        breadcrumb={breadcrumb}
        meta={headerMeta}
        title={title}
      />
      <div className={cn("flex min-w-0 flex-col gap-6 pb-12", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

export type AppStatusPageProps = {
  actions?: ReactNode;
  description?: ReactNode;
  /** Small mono detail under the description, e.g. an error digest. */
  detail?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

/**
 * Centred full-page state (error, not found) with the page's `<h1>`. Mirrors
 * the `EmptyState` look, which only offers h2/h3 titles.
 */
export function AppStatusPage({
  actions,
  description,
  detail,
  icon,
  title,
}: AppStatusPageProps) {
  return (
    <div
      className={cn(
        appPageContainerClassName("narrow"),
        "flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center",
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-4 flex size-14 items-center justify-center rounded-pill bg-surface-muted text-text-muted [&_svg]:size-8 [&_svg]:stroke-[1.5]"
        >
          {icon}
        </div>
      ) : null}
      <h1 className="text-title-3 text-text">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-sm text-callout text-text-muted">
          {description}
        </p>
      ) : null}
      {detail ? (
        <p className="mt-2 font-mono text-caption break-all text-text-muted">
          {detail}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
