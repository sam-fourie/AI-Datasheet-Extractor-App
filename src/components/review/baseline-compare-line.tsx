import { Equal, EqualApproximately, EqualNot } from "lucide-react";

import { cn } from "@/components/ui";
import type { AgreementOutcome, SubmissionAgreementRow } from "@/lib/submissions/types";

export type BaselineCompareLineProps = {
  className?: string;
  /** The agreement row for this re-run row, or null when it was not compared. */
  row: Pick<SubmissionAgreementRow, "baselineValue" | "outcome"> | null | undefined;
  /** "Show baseline values": also show the line on matching rows. */
  showMatches?: boolean;
};

const outcomeStyles: Record<
  AgreementOutcome,
  { className: string; icon: typeof Equal; label: string }
> = {
  match: { className: "text-success", icon: Equal, label: "matches" },
  mismatch: { className: "text-danger", icon: EqualNot, label: "differs from" },
  partial: { className: "text-warning", icon: EqualApproximately, label: "partly matches" },
};

/** Baseline values the agreement rows use for a missing value. */
function formatBaselineValue(value: string) {
  return value === "Not found" ? "Not in datasheet" : value;
}

/**
 * Re-run pages: "= Baseline 1.04 mm" under the value (§5.9). Always shown for
 * partial and mismatch rows; for matches only when `showMatches`.
 */
export function BaselineCompareLine({ className, row, showMatches = false }: BaselineCompareLineProps) {
  if (!row || (row.outcome === "match" && !showMatches)) {
    return null;
  }

  const style = outcomeStyles[row.outcome];
  const Icon = style.icon;
  const value = formatBaselineValue(row.baselineValue);

  return (
    <span className={cn("flex min-w-0 items-start gap-1 text-caption text-text-muted", className)}>
      <Icon aria-hidden="true" className={cn("mt-px size-3.5 shrink-0", style.className)} strokeWidth={2.25} />
      <span className="sr-only">This run {style.label} the baseline:</span>
      <span className="min-w-0 break-words">
        Baseline{" "}
        <span className={cn("text-text", row.baselineValue === "Not found" && "italic text-text-muted")}>
          {value}
        </span>
      </span>
    </span>
  );
}
