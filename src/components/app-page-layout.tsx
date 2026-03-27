import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

type AppPageLayoutProps = {
  action?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

export function AppPageLayout({
  action,
  bodyClassName,
  children,
  description,
  title,
}: AppPageLayoutProps) {
  return (
    <section className="min-w-0">
      <header className="border-b border-border bg-white/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 sm:px-8 md:flex-row md:items-end md:justify-between md:py-8">
          <div className="space-y-2">
            <h1 className="text-3xl tracking-[-0.04em] sm:text-4xl">{title}</h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-text-muted">
                {description}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8 md:py-8",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
