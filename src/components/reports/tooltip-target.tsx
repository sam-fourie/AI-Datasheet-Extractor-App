"use client";

import type { CSSProperties, ReactNode } from "react";

import { AppLink } from "@/components/app-link";
import { Tooltip, type FloatingSide } from "@/components/ui";

export type TooltipTargetProps = {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  content: ReactNode;
  describeChild?: boolean;
  /** Renders a guard-aware link instead of a span. */
  href?: string;
  role?: "img";
  side?: FloatingSide;
  style?: CSSProperties;
  tabIndex?: number;
};

/**
 * A Tooltip trigger created on the client. `Tooltip` clones its child to add
 * `aria-describedby`; a child element created in a Server Component is not
 * clonable during SSR, so the server HTML and the client disagree and React
 * reports a hydration mismatch. Creating the trigger here avoids that while
 * keeping the chart components themselves on the server.
 */
export function TooltipTarget({
  children,
  content,
  describeChild,
  href,
  side,
  ...props
}: TooltipTargetProps) {
  return (
    <Tooltip content={content} describeChild={describeChild} side={side}>
      {href ? (
        <AppLink href={href} {...props}>
          {children}
        </AppLink>
      ) : (
        <span {...props}>{children}</span>
      )}
    </Tooltip>
  );
}
