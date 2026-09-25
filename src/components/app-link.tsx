"use client";

import type { ComponentProps } from "react";

import Link from "next/link";

import { useNavigationGuardInterceptor } from "@/components/navigation-blocker-provider";

export type AppLinkProps = ComponentProps<typeof Link>;
type AppLinkNavigateEvent = Parameters<
  NonNullable<AppLinkProps["onNavigate"]>
>[0];
type UrlObjectLike = Exclude<AppLinkProps["href"], string>;

function hrefToString(href: AppLinkProps["href"]): string {
  if (typeof href === "string") {
    return href;
  }

  return formatUrlObject(href);
}

function formatUrlObject(url: UrlObjectLike): string {
  const pathname = url.pathname ?? "";
  let search = url.search ?? "";

  if (!search && url.query) {
    const params = new URLSearchParams();

    if (typeof url.query === "string") {
      search = url.query ? `?${url.query.replace(/^\?/, "")}` : "";
    } else {
      for (const [key, value] of Object.entries(url.query)) {
        if (Array.isArray(value)) {
          value.forEach((item) => params.append(key, String(item)));
        } else if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }

      const serialized = params.toString();
      search = serialized ? `?${serialized}` : "";
    }
  } else if (search && !search.startsWith("?")) {
    search = `?${search}`;
  }

  const hash = url.hash ? (url.hash.startsWith("#") ? url.hash : `#${url.hash}`) : "";

  return `${pathname}${search}${hash}`;
}

/**
 * Next `Link` that respects the navigation guard. While a navigation-level
 * guard is active, a click opens the guard dialog instead, and choosing
 * Leave completes the navigation to this link's href.
 */
export function AppLink({ href, onNavigate, replace, ...props }: AppLinkProps) {
  const interceptNavigation = useNavigationGuardInterceptor();

  function handleNavigate(event: AppLinkNavigateEvent) {
    let prevented = false;

    onNavigate?.({
      preventDefault: () => {
        prevented = true;
        event.preventDefault();
      },
    });

    if (prevented) {
      return;
    }

    if (interceptNavigation(hrefToString(href), { replace })) {
      event.preventDefault();
    }
  }

  return (
    <Link {...props} href={href} onNavigate={handleNavigate} replace={replace} />
  );
}
