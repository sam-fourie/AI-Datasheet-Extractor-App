import { cn } from "@/components/ui";
import { scoreTone, type ScoreTone } from "@/lib/submissions/score";

export type ScoreBadgeKind = "accuracy" | "agreement";
export type ScoreBadgeSize = "sm" | "md";

export type ScoreBadgeProps = {
  className?: string;
  kind: ScoreBadgeKind;
  /**
   * False renders the number in neutral grey (an unscored agreement, see
   * isScoredAgreement). Defaults to true.
   */
  scored?: boolean;
  size?: ScoreBadgeSize;
  /** Percentage 0 to 100, or null when there is no score. */
  value: number | null;
};

const dotClassNames: Record<ScoreTone, string> = {
  danger: "bg-danger",
  neutral: "bg-pending",
  success: "bg-success",
  warning: "bg-warning",
};

const sizeClassNames: Record<ScoreBadgeSize, string> = {
  md: "text-body",
  sm: "text-callout",
};

const kindLabels: Record<ScoreBadgeKind, string> = {
  accuracy: "accuracy",
  agreement: "agreement",
};

/** A 6 px tone dot plus the tabular percentage, e.g. "● 84%". */
export function ScoreBadge({
  className,
  kind,
  scored = true,
  size = "md",
  value,
}: ScoreBadgeProps) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const tone = scored && hasValue ? scoreTone(value) : "neutral";
  const text = hasValue ? `${Math.round(value)}%` : "—";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap tabular-nums",
        tone === "neutral" ? "text-text-muted" : "text-text",
        sizeClassNames[size],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-pill", dotClassNames[tone])}
      />
      <span aria-hidden={hasValue ? undefined : true}>{text}</span>
      <span className="sr-only">
        {hasValue ? ` ${kindLabels[kind]}` : `No ${kindLabels[kind]} score`}
      </span>
    </span>
  );
}
