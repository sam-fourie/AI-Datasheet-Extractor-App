"use client";

import { useId, useState, type ReactNode } from "react";

import {
  buttonClassName,
  Card,
  cn,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";

import { ChartCardHeader } from "./report-section";

export type ChartDataColumn = {
  label: string;
  numeric?: boolean;
};

export type ChartDataTable = {
  caption: string;
  columns: ChartDataColumn[];
  /** Cells in column order; the first cell is the row header. */
  rows: Array<{ cells: ReactNode[]; key: string }>;
};

export type ChartCardProps = {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  /** Muted footnote under the chart. */
  footnote?: ReactNode;
  title: ReactNode;
  /** The chart's numbers as a table (its text alternative). */
  table?: ChartDataTable | null;
};

/**
 * A chart's single surface: h3 title, the chart, an optional footnote and a
 * "Show table" toggle. While collapsed the table stays in the accessibility
 * tree (visually hidden), so screen readers always get the numbers.
 */
export function ChartCard({
  children,
  className,
  description,
  footnote,
  table,
  title,
}: ChartCardProps) {
  const [open, setOpen] = useState(false);
  const tableId = useId();

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <ChartCardHeader
        action={
          table ? (
            <button
              aria-controls={tableId}
              aria-expanded={open}
              className={cn(
                buttonClassName({ size: "sm", variant: "plain" }),
                "pointer-coarse:min-h-11",
              )}
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              {open ? "Hide table" : "Show table"}
            </button>
          ) : null
        }
        description={description}
        title={title}
      />
      <div className="mt-5 min-w-0 flex-1">{children}</div>
      {footnote ? (
        <p className="mt-4 text-caption text-text-muted">{footnote}</p>
      ) : null}
      {table ? <ChartTable id={tableId} open={open} table={table} /> : null}
    </Card>
  );
}

function ChartTable({
  id,
  open,
  table,
}: {
  id: string;
  open: boolean;
  table: ChartDataTable;
}) {
  return (
    <div className={open ? "mt-5" : "sr-only"} id={id}>
      <div
        aria-label={table.caption}
        className="relative -mx-5 max-w-none overflow-x-auto border-t border-border-subtle sm:-mx-6"
        role="region"
        tabIndex={open ? 0 : -1}
      >
        <Table caption={table.caption} density="compact" scrollX={false}>
          <THead>
            <tr>
              {table.columns.map((column) => (
                <Th key={column.label} numeric={column.numeric}>
                  {column.label}
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {table.rows.map((row) => (
              <Tr key={row.key}>
                {row.cells.map((cell, index) =>
                  index === 0 ? (
                    <th
                      className="px-3 py-1.5 text-left font-normal text-text first:pl-4"
                      key={index}
                      scope="row"
                    >
                      {cell}
                    </th>
                  ) : (
                    <Td key={index} numeric={table.columns[index]?.numeric}>
                      {cell}
                    </Td>
                  ),
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
