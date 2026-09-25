"use client";

import { FileSearch } from "lucide-react";
import { usePathname } from "next/navigation";

import { AppLink } from "@/components/app-link";
import {
  isPrimaryNavItemActive,
  PRIMARY_NAV_ITEMS,
  PrimaryNavIcon,
} from "@/components/app-sidebar-nav";
import { cn } from "@/components/ui";

/** `/submissions/[id]` and the `/preview/review` sandbox, which renders the same workspace. */
const REVIEW_ROUTE_PATTERN = /^\/(?:submissions\/[^/]+|preview\/review)\/?$/;

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-xs bg-accent text-white",
        className,
      )}
    >
      <FileSearch className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

/**
 * Top bar below 1024 px (spec §1.4). Sticky everywhere except the review
 * routes, where the review header takes over the top of the viewport.
 */
export function AppMobileNav() {
  const pathname = usePathname();
  const isReviewRoute = REVIEW_ROUTE_PATTERN.test(pathname);

  return (
    <header
      className={cn(
        "z-40 flex h-(--ui-topbar-height) items-center justify-between gap-2 border-b border-border bg-material px-4 backdrop-blur-[20px] backdrop-saturate-[1.8] sm:px-6 lg:hidden",
        isReviewRoute ? "relative" : "sticky top-0",
      )}
    >
      <AppLink
        aria-label="AI Datasheet Extractor, new extraction"
        className="-m-1 flex shrink-0 items-center rounded-sm p-1"
        href="/"
      >
        <BrandGlyph />
      </AppLink>
      <nav aria-label="Primary" className="min-w-0">
        <ul className="flex items-center gap-0.5">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = isPrimaryNavItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <AppLink
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-callout font-medium whitespace-nowrap transition-colors duration-(--ui-duration-fast) ease-ui max-[359px]:px-2 pointer-coarse:h-11",
                    isActive
                      ? "bg-surface-selected text-text"
                      : "text-text-muted hover:bg-surface-hover hover:text-text",
                  )}
                  href={item.href}
                >
                  <PrimaryNavIcon
                    className="max-[359px]:hidden"
                    icon={item.icon}
                    isActive={isActive}
                  />
                  <span>
                    {item.shortLabel}
                    {item.label !== item.shortLabel &&
                    item.label.startsWith(item.shortLabel) ? (
                      <span className="sr-only">
                        {item.label.slice(item.shortLabel.length)}
                      </span>
                    ) : null}
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
