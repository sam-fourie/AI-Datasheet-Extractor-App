import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./cn";

export type TableDensity = "default" | "compact";

export type TableProps = ComponentPropsWithoutRef<"table"> & {
  /** Table caption; visually hidden unless `captionVisible`. */
  caption?: ReactNode;
  captionVisible?: boolean;
  containerClassName?: string;
  density?: TableDensity;
  /**
   * Wraps the table in a horizontal scroller (default). Turn off when the
   * header must stick to the page, since a scroller becomes the sticky root.
   */
  scrollX?: boolean;
  /** Header cells stick to the top of the nearest scroll container. */
  stickyHeader?: boolean;
};

/**
 * Data table. Rows are 44 px (36 px compact) with hairline dividers and a
 * hover tint; the header is `surface-subtle` in caption type.
 */
export function Table({
  caption,
  captionVisible = false,
  children,
  className,
  containerClassName,
  density = "default",
  scrollX = true,
  stickyHeader = false,
  ...props
}: TableProps) {
  return (
    <div
      className={cn(
        // relative: contains absolutely positioned descendants (sr-only
        // text) so they scroll with the table instead of widening the page.
        scrollX && "relative max-w-full overflow-x-auto",
        containerClassName,
      )}
    >
      <table
        className={cn(
          "group/table w-full border-collapse text-left text-body",
          className,
        )}
        data-density={density}
        data-sticky-header={stickyHeader ? "true" : undefined}
        {...props}
      >
        {caption ? (
          <caption
            className={cn(
              captionVisible
                ? "px-4 pt-3 pb-2 text-left text-callout text-text-muted"
                : "sr-only",
            )}
          >
            {caption}
          </caption>
        ) : null}
        {children}
      </table>
    </div>
  );
}

export function THead({
  className,
  ...props
}: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      className={cn("[&>tr]:hover:bg-transparent", className)}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      className={cn("[&>tr:last-child]:border-b-0", className)}
      {...props}
    />
  );
}

export type TrProps = ComponentPropsWithoutRef<"tr"> & {
  /** Highlights the row as selected or active. */
  selected?: boolean;
};

export function Tr({ className, selected = false, ...props }: TrProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "border-b border-border-subtle transition-colors duration-(--ui-duration-fast) hover:bg-surface-hover",
        selected && "bg-row-active hover:bg-row-active",
        className,
      )}
      {...props}
    />
  );
}

const cellPaddingClassName = "px-3 first:pl-4 last:pr-4";

export type ThProps = ComponentPropsWithoutRef<"th"> & {
  numeric?: boolean;
};

export function Th({ className, numeric = false, scope, ...props }: ThProps) {
  return (
    <th
      className={cn(
        cellPaddingClassName,
        "h-9 border-b border-border bg-surface-subtle text-caption font-medium whitespace-nowrap text-text-muted",
        "group-data-[sticky-header=true]/table:sticky group-data-[sticky-header=true]/table:top-(--ui-sticky-offset,0px) group-data-[sticky-header=true]/table:z-10",
        numeric ? "text-right tabular-nums" : "text-left",
        className,
      )}
      scope={scope ?? "col"}
      {...props}
    />
  );
}

export type TdProps = ComponentPropsWithoutRef<"td"> & {
  numeric?: boolean;
};

export function Td({ className, numeric = false, ...props }: TdProps) {
  return (
    <td
      className={cn(
        cellPaddingClassName,
        "h-11 py-2 align-middle group-data-[density=compact]/table:h-9 group-data-[density=compact]/table:py-1.5",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
