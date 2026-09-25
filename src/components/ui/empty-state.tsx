import type { ReactNode } from "react";

import { cn } from "./cn";

export type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  titleAs?: "h1" | "h2" | "h3" | "p";
};

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
  titleAs: Title = "h2",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        className,
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
      <Title className="text-[15px] leading-5 font-semibold text-text">
        {title}
      </Title>
      {description ? (
        <p className="mt-1 max-w-sm text-callout text-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
