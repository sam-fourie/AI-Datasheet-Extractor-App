"use client";

import type { SVGProps } from "react";

import { usePathname } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { cn } from "@/components/ui/cn";

const primaryLinks = [
  {
    href: "/",
    icon: WorkbenchIcon,
    label: "Intake Workbench",
  },
  {
    href: "/submissions",
    icon: SubmissionsIcon,
    label: "Submissions",
  },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function WorkbenchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

function SubmissionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M8.25 4.75h8A1.75 1.75 0 0 1 18 6.5v9.75A1.75 1.75 0 0 1 16.25 18h-8a1.75 1.75 0 0 1-1.75-1.75V6.5a1.75 1.75 0 0 1 1.75-1.75Z" />
      <path d="M10.75 10h3.5" />
      <path d="M10.75 13.5h3.5" />
      <path d="M5.75 8V17a2 2 0 0 0 2 2h8.5" />
    </svg>
  );
}

export function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="space-y-1">
      {primaryLinks.map((link) => {
        const isActive = isActiveLink(pathname, link.href);
        const Icon = link.icon;

        return (
          <AppLink
            key={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition duration-150 ease-out",
              isActive
                ? "bg-surface text-text shadow-soft ring-1 ring-inset ring-border"
                : "text-text-muted hover:bg-surface-muted hover:text-text",
            )}
            href={link.href}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{link.label}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}
