"use client";

import type { ComponentProps } from "react";

import Link from "next/link";

import { useNavigationBlocker } from "@/components/navigation-blocker-provider";

type AppLinkProps = ComponentProps<typeof Link>;
type AppLinkNavigateEvent = Parameters<NonNullable<AppLinkProps["onNavigate"]>>[0];

export function AppLink({ onNavigate, ...props }: AppLinkProps) {
  const { isBlocked, notifyBlockedNavigationAttempt } = useNavigationBlocker();

  function handleNavigate(event: AppLinkNavigateEvent) {
    onNavigate?.(event);

    if (!isBlocked) {
      return;
    }

    event.preventDefault();
    notifyBlockedNavigationAttempt();
  }

  return <Link {...props} onNavigate={handleNavigate} />;
}
