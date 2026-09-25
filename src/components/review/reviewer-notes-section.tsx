"use client";

import { Card, Textarea, cn } from "@/components/ui";
import { REVIEWER_NOTES_MAX_LENGTH, type ReviewMode } from "@/lib/submissions/review";

import { ReviewSection } from "./review-section";
import { REVIEW_SECTION_IDS, REVIEWER_NOTES_INPUT_ID } from "./types";

export type ReviewerNotesSectionProps = {
  className?: string;
  mode: ReviewMode;
  /** Edit mode: the draft's reviewerNotes changed. */
  onChange: (value: string) => void;
  /** The draft's reviewerNotes. */
  value: string;
};

/** The character counter appears once the note is this close to the limit. */
const COUNTER_THRESHOLD = REVIEWER_NOTES_MAX_LENGTH - 400;

/**
 * Reviewer notes (§4.3 item 9). Edit mode: an auto-growing textarea labelled
 * by the section heading, capped at the API's limit with a character counter
 * near it. Read mode: the text, or muted "No reviewer notes."
 */
export function ReviewerNotesSection({ className, mode, onChange, value }: ReviewerNotesSectionProps) {
  const headingId = `${REVIEW_SECTION_IDS.notes}-heading`;
  const counterId = `${REVIEWER_NOTES_INPUT_ID}-count`;
  const showCounter = value.length >= COUNTER_THRESHOLD;
  const atLimit = value.length >= REVIEWER_NOTES_MAX_LENGTH;

  return (
    <ReviewSection className={className} id={REVIEW_SECTION_IDS.notes} title="Reviewer notes">
      {mode === "edit" ? (
        <div className="space-y-1.5">
          <Textarea
            aria-describedby={showCounter ? counterId : undefined}
            aria-labelledby={headingId}
            autoGrow
            className="min-h-[82px] bg-surface"
            id={REVIEWER_NOTES_INPUT_ID}
            maxLength={REVIEWER_NOTES_MAX_LENGTH}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Anything the next reviewer should know, e.g. which drawing you used."
            rows={3}
            value={value}
          />
          {showCounter ? (
            <p
              className={cn(
                "text-right text-caption tabular-nums",
                atLimit ? "text-warning" : "text-text-muted",
              )}
              id={counterId}
            >
              {value.length.toLocaleString("en")} / {REVIEWER_NOTES_MAX_LENGTH.toLocaleString("en")}
              {atLimit ? " · limit reached" : null}
            </p>
          ) : null}
        </div>
      ) : (
        <Card padding="none" className="px-4 py-3">
          {value.trim() ? (
            <p className="text-body break-words whitespace-pre-wrap text-text">{value}</p>
          ) : (
            <p className="text-callout text-text-muted">No reviewer notes.</p>
          )}
        </Card>
      )}
    </ReviewSection>
  );
}
