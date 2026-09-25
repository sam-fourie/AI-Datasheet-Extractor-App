import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { AppLink } from "@/components/app-link";

import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";

export type LinkButtonProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  children?: ReactNode;
  /** Opens in a new tab with an arrow icon and "(opens in new tab)" for screen readers. */
  external?: boolean;
  href: string;
  iconOnly?: boolean;
  /** Replace the current history entry instead of pushing (internal links only). */
  replace?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

/**
 * A link that looks like a button. Internal links go through `AppLink`, so
 * navigation guards apply.
 */
export function LinkButton({
  children,
  className,
  external = false,
  href,
  iconOnly = false,
  replace,
  size = "md",
  variant = "secondary",
  ...props
}: LinkButtonProps) {
  const classNames = buttonClassName({ className, iconOnly, size, variant });

  if (external) {
    return (
      <a
        {...props}
        className={classNames}
        href={href}
        rel="noopener"
        target="_blank"
      >
        {children}
        {iconOnly ? null : <ArrowUpRight aria-hidden="true" />}
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }

  return (
    <AppLink {...props} className={classNames} href={href} replace={replace}>
      {children}
    </AppLink>
  );
}
