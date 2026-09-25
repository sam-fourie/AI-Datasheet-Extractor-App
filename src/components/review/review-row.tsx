"use client";

import type { ReactNode } from "react";

import { cn } from "@/components/ui";
import { rowKeyOf, type ReviewRowRef } from "@/lib/submissions/review";
import type { ReviewDecisionStatus } from "@/lib/submissions/types";

import { DecisionLabel, DecisionToggle, type DecisionToggleLabels } from "./decision-toggle";
import { correctionEditorDomId, rowDomId, type ReviewRowCallbacks } from "./types";

export type ReviewRowProps = {
  /** Spoken name of the row, e.g. "Body Length, AI value 4.90 mm, pending" (§5.7). */
  accessibleName: string;
  callbacks: Pick<
    ReviewRowCallbacks,
    "onActivate" | "onCloseCorrection" | "onDecide" | "onOpenCorrection"
  >;
  /** Content cells. They are placed inside the grid given by `gridClassName`. */
  children: ReactNode;
  className?: string;
  /** Pin rows: content-visibility:auto with a 40 px intrinsic size. */
  contentVisibility?: boolean;
  decision: ReviewDecisionStatus;
  /** Grid placement of the decision cell, e.g. "[grid-area:decision]". */
  decisionClassName?: string;
  /** Hairline divider above the row, inset 44 px from the left. */
  divider?: boolean;
  /** The correction editor, rendered under the row while it is open (edit mode only). */
  editor?: ReactNode;
  /** Grid template for the row content (layout differs per row kind). */
  gridClassName: string;
  /** Edit mode: live decision toggle. Read mode: static label at the same width. */
  interactive: boolean;
  isActive: boolean;
  /** The correction editor is open on this row ("armed" Incorrect segment). */
  isEditing: boolean;
  /**
   * Visible only because it is in the sticky set (decided while the filter
   * excludes it): rendered without the active background (§5.3).
   */
  isStickyOnly?: boolean;
  /** Roving tabindex: exactly one row in the list has this set. */
  isTabStop: boolean;
  labels?: DecisionToggleLabels;
  rowRef: ReviewRowRef;
  /** Toggle subject: "Body Length" or "pin 8, VCC" ("Decision for …"). */
  subject: string;
};

/**
 * The shared row shell for package, measurement and pin rows. It renders the
 * same DOM in read and edit mode (only the decision cell swaps between the
 * toggle and a same-width label), so switching modes causes no layout shift.
 *
 * DOM: `<div id="row-…" role="group" tabindex>` with `data-row-key`. The
 * active row gets the row-active tint and a 2 px inset accent bar. Clicking
 * anywhere in the row (or focusing into it) activates it.
 */
export function ReviewRow({
  accessibleName,
  callbacks,
  children,
  className,
  contentVisibility = false,
  decision,
  decisionClassName,
  divider = false,
  editor,
  gridClassName,
  interactive,
  isActive,
  isEditing,
  isStickyOnly = false,
  isTabStop,
  labels = "auto",
  rowRef,
  subject,
}: ReviewRowProps) {
  const showActive = isActive && !isStickyOnly;
  const editorOpen = interactive && isEditing && editor != null;

  return (
    <div
      aria-label={accessibleName}
      className={cn(
        "relative scroll-mt-[calc(var(--ui-header-height)+var(--ui-toolbar-height)+40px)] scroll-mb-24 transition-colors duration-(--ui-duration-fast) ease-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        showActive
          ? "bg-row-active shadow-[inset_2px_0_0_var(--ui-accent)]"
          : "hover:bg-surface-hover",
        divider &&
          "before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-11 before:h-px before:bg-border-subtle",
        contentVisibility &&
          !editorOpen &&
          "[contain-intrinsic-size:auto_48px] [content-visibility:auto] md:[contain-intrinsic-size:auto_40px]",
        className,
      )}
      data-active={showActive || undefined}
      data-decision={decision}
      data-row-key={rowKeyOf(rowRef)}
      id={rowDomId(rowRef)}
      onClick={() => {
        if (!isActive) {
          callbacks.onActivate(rowRef);
        }
      }}
      onFocus={(event) => {
        // Focus moving into the row (Tab, toggle click, editor autofocus).
        if (!isActive && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          callbacks.onActivate(rowRef);
        }
      }}
      role="group"
      tabIndex={isTabStop ? 0 : -1}
    >
      <div className={gridClassName}>
        {children}
        <div className={cn("flex justify-end", decisionClassName)}>
          {interactive ? (
            <DecisionToggle
              armed={isEditing}
              controlsId={correctionEditorDomId(rowRef)}
              decision={decision}
              labels={labels}
              onConfirm={() => {
                if (!isActive) {
                  callbacks.onActivate(rowRef);
                }

                callbacks.onDecide(rowRef, decision === "confirmed" ? "pending" : "confirmed");
              }}
              onIncorrect={() => {
                if (!isActive) {
                  callbacks.onActivate(rowRef);
                }

                if (isEditing) {
                  callbacks.onCloseCorrection(rowRef);
                } else {
                  callbacks.onOpenCorrection(rowRef);
                }
              }}
              subject={subject}
              tabbable={isTabStop || isActive}
            />
          ) : (
            <DecisionLabel decision={decision} labels={labels} />
          )}
        </div>
      </div>
      {editorOpen ? editor : null}
    </div>
  );
}
