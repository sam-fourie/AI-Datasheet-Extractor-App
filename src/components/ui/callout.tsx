"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "./cn";

export type CalloutTone =
  "neutral" | "accent" | "warning" | "danger" | "success";

export type CalloutProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Adds a close button. Uncontrolled unless `onDismiss` handles it. */
  dismissible?: boolean;
  /** Custom icon, or `false` for none. Defaults to the tone's icon. */
  icon?: ReactNode | false;
  id?: string;
  onDismiss?: () => void;
  /** Defaults to "alert" for danger and none otherwise. */
  role?: "alert" | "status" | "note";
  tabIndex?: number;
  title?: ReactNode;
  tone?: CalloutTone;
};

const toneClassNames: Record<CalloutTone, { container: string; icon: string }> =
  {
    neutral: { container: "bg-surface-muted", icon: "text-text-muted" },
    accent: { container: "bg-accent-soft", icon: "text-accent-text" },
    warning: { container: "bg-warning-soft", icon: "text-warning" },
    danger: { container: "bg-danger-soft", icon: "text-danger" },
    success: { container: "bg-success-soft", icon: "text-success" },
  };

const defaultIcons: Record<CalloutTone, ReactNode> = {
  neutral: <Info />,
  accent: <Info />,
  warning: <TriangleAlert />,
  danger: <CircleAlert />,
  success: <CircleCheck />,
};

export function Callout({
  actions,
  children,
  className,
  dismissible = false,
  icon,
  id,
  onDismiss,
  role,
  tabIndex,
  title,
  tone = "neutral",
}: CalloutProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const resolvedIcon = icon === false ? null : (icon ?? defaultIcons[tone]);
  const resolvedRole = role ?? (tone === "danger" ? "alert" : undefined);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-md px-4 py-3 text-body text-text outline-none",
        toneClassNames[tone].container,
        className,
      )}
      id={id}
      role={resolvedRole}
      tabIndex={tabIndex}
    >
      {resolvedIcon ? (
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex shrink-0 [&_svg]:size-4",
            toneClassNames[tone].icon,
          )}
        >
          {resolvedIcon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div
            className={cn(
              "text-callout",
              title
                ? cn(
                    "mt-0.5",
                    tone === "neutral" ? "text-text-muted" : "text-text-on-tint",
                  )
                : "text-text",
            )}
          >
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {dismissible ? (
        <button
          aria-label="Dismiss"
          className="-mt-1 -mr-2 flex size-7 shrink-0 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-text pointer-coarse:size-11"
          onClick={() => {
            if (onDismiss) {
              onDismiss();
            } else {
              setDismissed(true);
            }
          }}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
