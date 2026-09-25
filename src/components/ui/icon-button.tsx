import type { ReactNode } from "react";

import { Button, type ButtonProps } from "./button";
import { Kbd } from "./kbd";
import { Tooltip } from "./tooltip";
import type { FloatingSide } from "./floating";

export type IconButtonProps = Omit<
  ButtonProps,
  "aria-label" | "children" | "iconOnly"
> & {
  icon: ReactNode;
  /** Accessible name, also shown as the tooltip. */
  label: string;
  /** Optional shortcut shown in the tooltip, e.g. "⌘S". */
  shortcut?: string;
  tooltip?: boolean;
  tooltipSide?: FloatingSide;
};

export function IconButton({
  icon,
  label,
  shortcut,
  tooltip = true,
  tooltipSide = "top",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  const button = (
    <Button {...props} aria-label={label} iconOnly variant={variant}>
      {icon}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip
      content={
        shortcut ? (
          <span className="inline-flex items-center gap-2">
            {label}
            <Kbd>{shortcut}</Kbd>
          </span>
        ) : (
          label
        )
      }
      describeChild={Boolean(shortcut)}
      side={tooltipSide}
    >
      {button}
    </Tooltip>
  );
}
