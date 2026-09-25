"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import { cn, TBody } from "@/components/ui";

import { pluralize } from "./datasheet-list-format";

type RunsDisclosureContextValue = {
  controls: string;
  expanded: boolean;
  toggle: () => void;
};

const RunsDisclosureContext = createContext<RunsDisclosureContextValue | null>(null);

export type RunsDisclosureGroupProps = {
  children: ReactNode;
  /** Ids of the server-rendered run rows this group shows and hides. */
  runRowIds: string[];
  /** Baseline id, used to find this group when moving focus after a delete. */
  groupId: string;
};

/**
 * One `<tbody>` per datasheet group. All rows are server-rendered; this island
 * only holds the expanded state. Run rows hide themselves with
 * `group-data-[expanded=false]/runs:hidden`.
 */
export function RunsDisclosureGroup({
  children,
  groupId,
  runRowIds,
}: RunsDisclosureGroupProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <RunsDisclosureContext.Provider
      value={{
        controls: runRowIds.join(" "),
        expanded,
        toggle: () => setExpanded((value) => !value),
      }}
    >
      <TBody
        className="group/runs border-b border-border-subtle last:border-b-0"
        data-expanded={expanded ? "true" : "false"}
        data-group-id={groupId}
      >
        {children}
      </TBody>
    </RunsDisclosureContext.Provider>
  );
}

export type RunsDisclosureButtonProps = {
  className?: string;
  count: number;
  partNumber: string;
  /** "column" is the desktop Runs cell; "chip" sits in the mobile meta line. */
  variant?: "column" | "chip";
};

/** "4 runs ⌄". Sits above the row's stretched link. */
export function RunsDisclosureButton({
  className,
  count,
  partNumber,
  variant = "column",
}: RunsDisclosureButtonProps) {
  const context = useContext(RunsDisclosureContext);

  if (!context) {
    return null;
  }

  return (
    <button
      aria-controls={context.controls}
      aria-expanded={context.expanded}
      className={cn(
        "relative z-10 inline-flex items-center gap-1 rounded-xs whitespace-nowrap transition-colors duration-(--ui-duration-fast) ease-ui",
        "before:absolute before:-inset-x-1.5 before:-inset-y-1 before:content-[''] pointer-coarse:before:-inset-3",
        variant === "column"
          ? "-mx-1.5 px-1.5 py-0.5 text-body text-text hover:bg-surface-hover"
          : "text-caption text-text-muted hover:text-text",
        className,
      )}
      onClick={context.toggle}
      type="button"
    >
      {pluralize(count, "run")}
      <span className="sr-only"> for {partNumber}</span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "shrink-0 text-text-muted transition-transform duration-(--ui-duration) ease-ui",
          variant === "column" ? "size-4" : "size-3.5",
          context.expanded && "rotate-180",
        )}
      />
    </button>
  );
}
