import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

export type StatTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type StatGroupProps = ComponentPropsWithoutRef<"dl"> & {
  /**
   * The breakpoint where the stats become one row of equal columns (default
   * md). Use xl for five or more stats that would be cramped at tablet widths.
   */
  columnsFrom?: "md" | "xl";
};

// Full literals so Tailwind sees every class. Below the breakpoint the stats
// form two columns, and an odd last stat spans both (no empty gray cell on the
// hairline surface).
const singleRowClassNames: Record<NonNullable<StatGroupProps["columnsFrom"]>, string> = {
  md: "md:auto-cols-fr md:grid-flow-col md:grid-cols-none md:[&>*:last-child:nth-child(odd)]:col-span-1",
  xl: "xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none xl:[&>*:last-child:nth-child(odd)]:col-span-1",
};

/**
 * One surface split by hairlines: a row of equal columns from `columnsFrom`,
 * a two-column grid below. Children are `Stat`s.
 */
export function StatGroup({ className, columnsFrom = "md", ...props }: StatGroupProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border shadow-card [&>*:last-child:nth-child(odd)]:col-span-2",
        singleRowClassNames[columnsFrom],
        className,
      )}
      {...props}
    />
  );
}

export type StatProps = {
  caption?: ReactNode;
  className?: string;
  label: ReactNode;
  tone?: StatTone;
  value: ReactNode;
};

const toneClassNames: Record<StatTone, string> = {
  neutral: "text-text",
  accent: "text-accent-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Stat({
  caption,
  className,
  label,
  tone = "neutral",
  value,
}: StatProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 bg-surface px-5 py-4",
        className,
      )}
    >
      <dt className="text-callout text-text-muted">{label}</dt>
      <dd className={cn("text-stat tabular-nums", toneClassNames[tone])}>
        {value}
      </dd>
      {caption ? (
        <dd className="text-callout text-text-muted">{caption}</dd>
      ) : null}
    </div>
  );
}
