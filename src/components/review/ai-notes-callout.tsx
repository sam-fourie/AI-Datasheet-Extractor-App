"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Callout, cn } from "@/components/ui";
import { extractPageReferences } from "@/lib/submissions/evidence";
import type { ReviewSummary } from "@/lib/package-categories";

export type AiNotesCalloutProps = {
  className?: string;
  /**
   * Initial state when uncontrolled. The workspace passes
   * `review.needsReview && mode === "edit"` (§4.3 item 4).
   */
  defaultExpanded?: boolean;
  /** Controlled expanded state (optional). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Omit when the PDF can't be shown: page mentions stay plain text. */
  onShowPage?: (page: number) => void;
  /** extraction.review */
  summary: ReviewSummary;
};

const PAGE_LINK_CLASS =
  "rounded-xs font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text";

/**
 * Page mentions become inline links, one treatment for every reference: a
 * single-page mention ("page 13") links as a whole; in a multi-page mention
 * ("pages 112 and 113", "pp. 3-5") each page number is its own link and the
 * words between stay plain text.
 */
function renderNote(note: string, onShowPage?: (page: number) => void): ReactNode {
  const references = extractPageReferences(note);

  if (references.length === 0 || !onShowPage) {
    return note;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  references.forEach((reference, index) => {
    parts.push(note.slice(cursor, reference.start));

    if (reference.pages.length === 1) {
      parts.push(
        <button
          aria-label={`${reference.text}, show page ${reference.pages[0]}`}
          className={PAGE_LINK_CLASS}
          key={index}
          onClick={() => onShowPage(reference.pages[0])}
          type="button"
        >
          {reference.text}
        </button>,
      );
    } else {
      parts.push(
        <Fragment key={index}>
          {reference.text.split(/(\d+)/).map((segment, segmentIndex) => {
            const page = /^\d+$/.test(segment) ? Number.parseInt(segment, 10) : null;

            return page !== null && reference.pages.includes(page) ? (
              <button
                aria-label={`Show page ${page}`}
                className={PAGE_LINK_CLASS}
                key={segmentIndex}
                onClick={() => onShowPage(page)}
                type="button"
              >
                {segment}
              </button>
            ) : (
              segment
            );
          })}
        </Fragment>,
      );
    }

    cursor = reference.end;
  });

  parts.push(note.slice(cursor));

  return parts;
}

/**
 * "AI review notes (3)" (§4.3 item 4): a warning callout when the model
 * flagged the extraction, neutral otherwise. Collapsed to its header unless
 * expanded. Page mentions in the notes become inline page links. Renders nothing
 * when there are no notes and no flag.
 */
export function AiNotesCallout({
  className,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  onShowPage,
  summary,
}: AiNotesCalloutProps) {
  const [expandedState, setExpandedState] = useState(defaultExpanded);
  const expanded = expandedProp ?? expandedState;
  const contentId = useId();
  const notes = summary.notes.map((note) => note.trim()).filter(Boolean);
  const flagged = summary.needsReview;

  if (!flagged && notes.length === 0) {
    return null;
  }

  function toggle() {
    const next = !expanded;

    setExpandedState(next);
    onExpandedChange?.(next);
  }

  return (
    <Callout
      className={className}
      title={
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="-mx-1 inline-flex items-center gap-1 rounded-xs px-1 text-left font-semibold pointer-coarse:min-h-11"
          onClick={toggle}
          type="button"
        >
          AI review notes{notes.length > 0 ? ` (${notes.length})` : ""}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-text-muted transition-transform duration-(--ui-duration) ease-ui",
              expanded ? "rotate-180" : undefined,
            )}
          />
        </button>
      }
      tone={flagged ? "warning" : "neutral"}
    >
      <div hidden={!expanded} id={contentId}>
        {flagged ? (
          <p className="text-callout text-text">The model flagged this extraction for review.</p>
        ) : null}
        {notes.length > 0 ? (
          <ul className={cn("list-disc space-y-1 pl-5 text-body text-text", flagged && "mt-2")}>
            {notes.map((note, index) => (
              <li key={index}>{renderNote(note, onShowPage)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Callout>
  );
}
