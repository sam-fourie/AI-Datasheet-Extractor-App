"use client";

import type { ReactNode } from "react";
import { ChartColumn, FilePlus2, Rows3, type LucideIcon } from "lucide-react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { SIDEBAR_REVEAL_CLASS_NAME } from "@/components/app-sidebar-classes";
import { cn } from "@/components/ui";

export type PrimaryNavItem = {
  href: string;
  icon: LucideIcon;
  /** Sidebar label. */
  label: string;
  /** Compact label for the mobile top bar. */
  shortLabel: string;
};

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { href: "/", icon: FilePlus2, label: "New extraction", shortLabel: "New" },
  {
    href: "/submissions",
    icon: Rows3,
    label: "Submissions",
    shortLabel: "Submissions",
  },
  { href: "/reports", icon: ChartColumn, label: "Reports", shortLabel: "Reports" },
];

export function isPrimaryNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A primary nav item's icon. Must render inside the item's link: while that
 * navigation is pending (slow network, not yet prefetched) the icon pulses.
 * The animation starts late, so fast navigations show nothing, and reduced
 * motion leaves it dimmed instead of pulsing.
 */
export function PrimaryNavIcon({
  className,
  icon: Icon,
  isActive,
}: {
  className?: string;
  icon: LucideIcon;
  isActive: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        isActive ? "text-accent" : undefined,
        pending ? "animate-nav-pending" : undefined,
        className,
      )}
    />
  );
}

export type AppSidebarNavProps = {
  /** Slot rendered at the right of the Submissions item (the review queue badge). */
  submissionsBadge?: ReactNode;
};

/**
 * Desktop primary navigation (spec §1.3), rendered inside the collapsible
 * rail in the root layout. Each item is a 40 px square while collapsed, with
 * its icon at the same position when expanded, so nothing jumps.
 */
export function AppSidebarNav({ submissionsBadge }: AppSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-0.5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = isPrimaryNavItemActive(pathname, item.href);

          return (
            <li key={item.href}>
              <AppLink
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-sm px-3 text-body font-medium transition-colors duration-(--ui-duration-fast) ease-ui pointer-coarse:h-11",
                  isActive
                    ? "bg-surface-selected text-text"
                    : "text-text-muted hover:bg-surface-hover hover:text-text",
                )}
                href={item.href}
              >
                <PrimaryNavIcon icon={item.icon} isActive={isActive} />
                <span className={cn("min-w-0 truncate", SIDEBAR_REVEAL_CLASS_NAME)}>
                  {item.label}
                </span>
                {item.href === "/submissions" ? submissionsBadge : null}
              </AppLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
