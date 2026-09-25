import { Badge, type BadgeSize, type BadgeTone } from "@/components/ui";
import { scoreTone } from "@/lib/submissions/score";
import type { AgreementBasis, ReviewProgress } from "@/lib/submissions/types";

export type ReviewStatusRerun = {
  agreementPercentage: number | null;
  basis: AgreementBasis | null;
  /** The baseline this run was compared against no longer exists. */
  baselineMissing?: boolean;
  baselineReviewedDecisions?: number | null;
  baselineTotalDecisions?: number | null;
  /** isScoredAgreement(agreement): reviewed basis AND a fully reviewed baseline. */
  isScored: boolean;
};

export type ReviewStatusBadgeProps = {
  className?: string;
  progress: ReviewProgress;
  /** Present on re-run pages and rows: the badge then describes agreement. */
  rerun?: ReviewStatusRerun | null;
  size?: BadgeSize;
};

type StatusDescription = { text: string; tone: BadgeTone };

function formatPercentage(value: number) {
  return `${Math.round(value)}%`;
}

/**
 * Text and tone for a review status badge (spec §4.3, addendum C). Exported
 * so list rows and tooltips can reuse the exact wording.
 */
export function describeReviewStatus(
  progress: ReviewProgress,
  rerun?: ReviewStatusRerun | null,
): StatusDescription {
  if (rerun) {
    if (rerun.baselineMissing) {
      return { text: "Re-run · baseline deleted", tone: "neutral" };
    }

    if (rerun.isScored && typeof rerun.agreementPercentage === "number") {
      return {
        text: `Re-run · ${formatPercentage(rerun.agreementPercentage)} agreement`,
        tone: scoreTone(rerun.agreementPercentage),
      };
    }

    if (rerun.basis === "unreviewed") {
      return { text: "Re-run · vs unreviewed baseline", tone: "neutral" };
    }

    if (rerun.basis === "reviewed") {
      const reviewed = rerun.baselineReviewedDecisions;
      const total = rerun.baselineTotalDecisions;
      const counts =
        typeof reviewed === "number" && typeof total === "number"
          ? ` (${reviewed} of ${total})`
          : "";

      return {
        text: `Re-run · vs partly reviewed baseline${counts}`,
        tone: "neutral",
      };
    }

    return { text: "Re-run", tone: "neutral" };
  }

  switch (progress.state) {
    case "reviewed":
      return progress.accuracy === null
        ? { text: "Reviewed", tone: "success" }
        : {
            text: `Reviewed · ${formatPercentage(progress.accuracy)}`,
            tone: scoreTone(progress.accuracy),
          };
    case "inProgress":
      return { text: "In review", tone: "accent" };
    default:
      return { text: "Not started", tone: "neutral" };
  }
}

/**
 * "Not started", "In review", "Reviewed · 84%", or for re-runs
 * "Re-run · 84% agreement", "Re-run · vs unreviewed baseline",
 * "Re-run · vs partly reviewed baseline (3 of 19)", "Re-run · baseline deleted".
 */
export function ReviewStatusBadge({
  className,
  progress,
  rerun,
  size = "md",
}: ReviewStatusBadgeProps) {
  const { text, tone } = describeReviewStatus(progress, rerun);

  return (
    <Badge className={className} size={size} tone={tone}>
      {text}
    </Badge>
  );
}
