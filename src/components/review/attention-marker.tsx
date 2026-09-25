"use client";

import { Tooltip, cn } from "@/components/ui";
import { describeAttentionReason, type AttentionReason } from "@/lib/submissions/review";
import type { AgreementOutcome } from "@/lib/submissions/types";

export type AttentionMarkerVariant = "full" | "compact";

export type AttentionMarkerTone = "warning" | "danger";

export type AttentionMarkerProps = {
  className?: string;
  /** From classifyRowAttention; the first reason is shown, the tooltip lists all. */
  reasons: readonly AttentionReason[];
  /**
   * Baseline pages: describeRunHint(hint), e.g. "3 of 4 runs differ". Replaces
   * the generic "Other model runs differ" wording and is shown next to the
   * first reason when that reason is something else (addendum J).
   */
  runHintText?: string | null;
  /**
   * "danger" when the first reason is a real mismatch with the baseline
   * (differsFromBaseline with a "mismatch" agreement outcome): red means a
   * baseline mismatch, amber means AI risk or a partial match. Default "warning".
   */
  tone?: AttentionMarkerTone;
  /**
   * "full": amber dot plus text. "compact": the text only shows when the
   * nearest `@container/review` is at least 560 px wide (pin rows).
   */
  variant?: AttentionMarkerVariant;
};

/**
 * Red only for a real baseline mismatch shown as the first reason; partial
 * matches and every AI-risk reason stay amber (§0.2 #10).
 */
export function attentionToneFor(
  reasons: readonly AttentionReason[],
  outcome: AgreementOutcome | null | undefined,
): AttentionMarkerTone {
  return reasons[0] === "differsFromBaseline" && outcome === "mismatch" ? "danger" : "warning";
}

/** Human wording for a reason, using the run hint for runsDisagree when given. */
export function describeReason(reason: AttentionReason, runHintText?: string | null) {
  return reason === "runsDisagree" && runHintText ? runHintText : describeAttentionReason(reason);
}

/** "needs attention: Medium confidence, No evidence page" for row accessible names, or null. */
export function describeReasonsForName(
  reasons: readonly AttentionReason[],
  runHintText?: string | null,
): string | null {
  return reasons.length > 0
    ? `needs attention: ${reasons.map((reason) => describeReason(reason, runHintText)).join(", ")}`
    : null;
}

/**
 * A 6 px dot plus the first attention reason (§5.2, §5.6): amber for AI risk,
 * red when the first reason is a baseline mismatch (`tone="danger"`).
 * The tooltip lists every reason. Renders nothing for a calm row. The row's
 * accessible name carries the same reasons for screen readers, so the marker
 * itself is not a tab stop.
 */
export function AttentionMarker({
  className,
  reasons,
  runHintText,
  tone = "warning",
  variant = "full",
}: AttentionMarkerProps) {
  if (reasons.length === 0) {
    return null;
  }

  const [first] = reasons;
  const primary = describeReason(first, runHintText);
  const showRunHint = first !== "runsDisagree" && reasons.includes("runsDisagree") && Boolean(runHintText);
  const remaining = reasons.length - 1 - (showRunHint ? 1 : 0);
  const all = reasons.map((reason) => describeReason(reason, runHintText));

  return (
    <Tooltip
      content={
        all.length === 1 ? (
          all[0]
        ) : (
          <ul className="space-y-0.5">
            {all.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )
      }
      describeChild={false}
    >
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-caption",
          tone === "danger" ? "text-danger" : "text-warning",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-pill", tone === "danger" ? "bg-danger" : "bg-warning")}
        />
        {/* Separate spans so "+N" is never truncated and the run hint wraps to its own line. */}
        <span
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-1",
            variant === "compact" && "sr-only @min-[560px]/review:not-sr-only",
          )}
        >
          <span className="min-w-0 truncate">{primary}</span>
          {showRunHint ? <span className="min-w-0 truncate">· {runHintText}</span> : null}
          {remaining > 0 ? <span className="shrink-0 text-text-muted">+{remaining}</span> : null}
        </span>
      </span>
    </Tooltip>
  );
}
