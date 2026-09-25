"use client";

import { Button, Card, LinkButton, ProgressBar, cn } from "@/components/ui";
import { AppLink } from "@/components/app-link";
import { isScoredAgreement } from "@/lib/submissions/agreement";
import type { ReviewMode, ReviewRowRef } from "@/lib/submissions/review";
import { scoreTone, type ScoreTone } from "@/lib/submissions/score";
import type { SubmissionAgreement } from "@/lib/submissions/types";

export type AgreementSummaryProps = {
  /** comparison.agreement of this re-run (computed on read). */
  agreement: SubmissionAgreement | null;
  /** Link to the baseline's review page, or null when it was deleted. */
  baselineHref: string | null;
  /** formatRunLabel(baseline providerMeta), e.g. "GPT-5.4 · High". */
  baselineLabel: string | null;
  /** comparison.baseline is null: the baseline was deleted. */
  baselineMissing: boolean;
  className?: string;
  /**
   * Re-run rows that match and are still pending (listMatchingPendingRefs).
   * The "Confirm N matching the reviewed baseline" button shows only when
   * the agreement is scored (addendum C), the mode is edit and N > 0.
   */
  matchingPendingRefs: readonly ReviewRowRef[];
  mode: ReviewMode;
  /** Baseline row labels the run has no counterpart for (listOnlyInBaselineRows(...).map(r => r.label)). */
  onlyInBaselineLabels?: readonly string[];
  onConfirmMatching: (refs: ReviewRowRef[]) => void;
};

const dotClassNames: Record<ScoreTone, string> = {
  danger: "bg-danger",
  neutral: "bg-pending",
  success: "bg-success",
  warning: "bg-warning",
};

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/**
 * Re-run pages (§5.9): the agreement score with the baseline, a match /
 * partial / differ bar with its legend, rows only in the baseline, and the
 * basis note. The score is coloured only when isScoredAgreement holds;
 * otherwise it is neutral and the basis note explains why (addendum C).
 */
export function AgreementSummary({
  agreement,
  baselineHref,
  baselineLabel,
  baselineMissing,
  className,
  matchingPendingRefs,
  mode,
  onConfirmMatching,
  onlyInBaselineLabels = [],
}: AgreementSummaryProps) {
  const labelSuffix = baselineLabel ? ` (${baselineLabel})` : "";

  if (baselineMissing || !agreement) {
    return (
      <Card className={className} padding="md">
        <p className="text-body text-text">
          {baselineMissing
            ? "The baseline for this run was deleted, so it can't be scored."
            : "Agreement isn't available for this run."}
        </p>
      </Card>
    );
  }

  const scored = isScoredAgreement(agreement);
  const tone: ScoreTone = scored ? scoreTone(agreement.agreementPercentage) : "neutral";
  const partlyReviewed = agreement.basis === "reviewed" && agreement.baselineReviewStatus !== "reviewed";
  const subject = scored
    ? "agreement with the reviewed baseline"
    : agreement.basis === "unreviewed"
      ? "agreement with the unreviewed baseline"
      : `agreement with the partly reviewed baseline (${agreement.baselineReviewedDecisions} of ${agreement.baselineTotalDecisions} reviewed)`;
  const showConfirmMatching = scored && mode === "edit" && matchingPendingRefs.length > 0;
  const percentage = agreement.agreementPercentage;

  return (
    <Card aria-label="Agreement with the baseline" className={cn("space-y-4", className)} padding="md" role="region">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", dotClassNames[tone])} />
          <span className={cn("text-stat tabular-nums", scored ? "text-text" : "text-text-muted")}>
            {percentage === null ? "—" : `${percentage}%`}
          </span>
        </p>
        <p className="min-w-0 text-callout text-text-muted">
          {subject}
          {labelSuffix}
        </p>
      </div>

      {agreement.compared > 0 ? (
        <div className="space-y-2">
          <ProgressBar
            label="Agreement with the baseline"
            segments={[
              { tone: "success", value: agreement.matches },
              { tone: "warning", value: agreement.partialMatches },
              { tone: "danger", value: agreement.mismatches },
            ]}
            total={agreement.compared}
            valueText={`${agreement.matches} of ${agreement.compared} match`}
            variant="md"
          />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-callout text-text-muted tabular-nums">
            <LegendItem className="bg-success" text={`${agreement.matches} match`} />
            <LegendItem className="bg-warning" text={`${agreement.partialMatches} partial`} />
            <LegendItem
              className="bg-danger"
              text={`${agreement.mismatches} ${plural(agreement.mismatches, "differs", "differ")}`}
            />
          </p>
        </div>
      ) : (
        <p className="text-callout text-text-muted">No reviewed rows to compare yet.</p>
      )}

      {onlyInBaselineLabels.length > 0 ? (
        <p className="text-callout text-text-muted">
          Only in baseline: <span className="text-text">{onlyInBaselineLabels.join(", ")}</span>
        </p>
      ) : null}

      {!scored ? (
        <p className="text-callout text-text-muted">
          {agreement.basis === "unreviewed"
            ? "The baseline isn't reviewed yet, so this compares raw AI output. "
            : partlyReviewed
              ? "The baseline is only partly reviewed, so this score isn't final. "
              : null}
          {baselineHref ? (
            <AppLink className="font-medium text-accent-text hover:underline" href={baselineHref}>
              {agreement.basis === "unreviewed" ? "Review the baseline →" : "Finish the baseline review →"}
            </AppLink>
          ) : null}
        </p>
      ) : null}

      {baselineHref || showConfirmMatching ? (
        <div className="flex flex-wrap items-center gap-2">
          {baselineHref ? (
            <LinkButton href={baselineHref} size="sm" variant="secondary">
              Open baseline
            </LinkButton>
          ) : null}
          {showConfirmMatching ? (
            <Button
              aria-label={`Confirm ${matchingPendingRefs.length} matching the reviewed baseline`}
              onClick={() => onConfirmMatching([...matchingPendingRefs])}
              size="sm"
              variant="secondary"
            >
              <span className="sm:hidden">Confirm {matchingPendingRefs.length} matching</span>
              <span className="hidden sm:inline">
                Confirm {matchingPendingRefs.length} matching the reviewed baseline
              </span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function LegendItem({ className, text }: { className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-1.5 rounded-pill", className)} />
      {text}
    </span>
  );
}
