import { Check, X } from "lucide-react";

import { cn } from "@/components/ui";
import type { ReviewDecisionStatus } from "@/lib/submissions/types";

/**
 * When segment labels show:
 * - "auto" (default): labels when the nearest `@container/review` is at least
 *   640 px wide, icon-only below that (§5.2). The lists set that container.
 * - "always" / "never": fixed.
 */
export type DecisionToggleLabels = "auto" | "always" | "never";

export type DecisionToggleProps = {
  /** Editor open with unapplied input: the Incorrect segment gets a danger border, no fill. */
  armed?: boolean;
  className?: string;
  /** id of the correction editor, for aria-controls on Incorrect while it is open. */
  controlsId?: string;
  decision: ReviewDecisionStatus;
  labels?: DecisionToggleLabels;
  /** Confirm segment. The caller decides confirm vs back-to-pending from `decision`. */
  onConfirm: () => void;
  /** Incorrect segment: open (or close, when armed) the correction editor. */
  onIncorrect: () => void;
  /** What is being decided, e.g. "Body Length" or "pin 8, VCC". Named "Decision for …". */
  subject: string;
  /** Roving tabindex: false removes both segments from the tab order. Default true. */
  tabbable?: boolean;
};

/* Segment widths are fixed so the read-mode label can take exactly the same
   width (no layout shift between modes). Icon-only: 32 px, 44 px on coarse
   pointers. Labelled: 96 px. The @max/@min container variants never overlap. */
const segmentWidth: Record<DecisionToggleLabels, string> = {
  always: "w-24 pointer-coarse:h-11",
  auto: "w-8 @max-[639px]/review:pointer-coarse:size-11 @min-[640px]/review:w-24 @min-[640px]/review:pointer-coarse:h-11",
  never: "w-8 pointer-coarse:size-11",
};

const labelVisibility: Record<DecisionToggleLabels, string> = {
  always: "",
  auto: "sr-only @min-[640px]/review:not-sr-only",
  never: "sr-only",
};

/** Width of the whole toggle, reused by the read-mode label. */
export const decisionColumnWidth: Record<DecisionToggleLabels, string> = {
  always: "w-48",
  auto: "w-16 @max-[639px]/review:pointer-coarse:w-[88px] @min-[640px]/review:w-48",
  never: "w-16 pointer-coarse:w-[88px]",
};

const segmentBase =
  "relative inline-flex h-[30px] shrink-0 items-center justify-center gap-1.5 border text-callout font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-(--ui-duration-fast) ease-ui focus-visible:z-[2] [&_svg]:size-3.5 [&_svg]:shrink-0";

const segmentIdle =
  "border-border-strong bg-transparent text-text-muted hover:bg-surface-hover hover:text-text";

/**
 * Two-segment Confirm | Incorrect group (§5.2). Each segment is a toggle
 * button with aria-pressed; the group is named "Decision for {subject}".
 */
export function DecisionToggle({
  armed = false,
  className,
  controlsId,
  decision,
  labels = "auto",
  onConfirm,
  onIncorrect,
  subject,
  tabbable = true,
}: DecisionToggleProps) {
  const confirmed = decision === "confirmed";
  const corrected = decision === "corrected";

  return (
    <div
      aria-label={`Decision for ${subject}`}
      className={cn("inline-flex shrink-0", className)}
      role="group"
    >
      <button
        aria-pressed={confirmed}
        className={cn(
          segmentBase,
          segmentWidth[labels],
          "rounded-l-sm",
          confirmed
            ? "z-[1] border-success-ring bg-success-soft text-success hover:bg-success-soft"
            : segmentIdle,
        )}
        onClick={(event) => {
          event.stopPropagation();
          onConfirm();
        }}
        tabIndex={tabbable ? 0 : -1}
        type="button"
      >
        <Check aria-hidden="true" strokeWidth={2.5} />
        <span className={labelVisibility[labels]}>Confirm</span>
      </button>
      <button
        aria-controls={armed ? controlsId : undefined}
        aria-expanded={armed}
        aria-pressed={corrected}
        className={cn(
          segmentBase,
          segmentWidth[labels],
          "-ml-px rounded-r-sm",
          armed
            ? "z-[1] border-danger bg-transparent text-danger hover:bg-danger-soft"
            : corrected
              ? "z-[1] border-danger-ring bg-danger-soft text-danger hover:bg-danger-soft"
              : segmentIdle,
        )}
        onClick={(event) => {
          event.stopPropagation();
          onIncorrect();
        }}
        tabIndex={tabbable ? 0 : -1}
        type="button"
      >
        <X aria-hidden="true" strokeWidth={2.5} />
        <span className={labelVisibility[labels]}>Incorrect</span>
      </button>
    </div>
  );
}

const readLabels: Record<ReviewDecisionStatus, { className: string; text: string }> = {
  confirmed: { className: "text-success", text: "Confirmed" },
  corrected: { className: "text-danger", text: "Corrected" },
  pending: { className: "text-text-muted", text: "Pending" },
};

export type DecisionLabelProps = {
  className?: string;
  decision: ReviewDecisionStatus;
  labels?: DecisionToggleLabels;
};

/**
 * Read mode: a static 12 px "Confirmed" / "Corrected" / "Pending" label at the
 * toggle's exact width, so switching modes causes no layout shift (§5.1).
 */
export function DecisionLabel({ className, decision, labels = "auto" }: DecisionLabelProps) {
  const { className: toneClassName, text } = readLabels[decision];

  return (
    <span
      className={cn(
        "inline-flex h-[30px] shrink-0 items-center justify-end text-caption font-medium",
        decisionColumnWidth[labels],
        labels === "always"
          ? "pointer-coarse:h-11"
          : labels === "auto"
            ? "@max-[639px]/review:pointer-coarse:h-11 @min-[640px]/review:pointer-coarse:h-11"
            : "pointer-coarse:h-11",
        toneClassName,
        className,
      )}
    >
      {text}
    </span>
  );
}
