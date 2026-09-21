import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type {
  AgreementOutcome,
  SubmissionAgreement,
  SubmissionComparison,
} from "@/lib/submissions/types";

type Tone = "danger" | "neutral" | "success" | "warning";

const toneClassNames: Record<Tone, string> = {
  danger: "border-danger-ring bg-danger-soft text-danger-strong",
  neutral: "border-border bg-surface-muted text-text-muted",
  success: "border-success-ring bg-success-soft text-success-strong",
  warning: "border-warning-ring bg-warning-soft text-warning-strong",
};

const pillSizeClassNames = {
  md: "rounded-pill border px-4 py-2 text-sm font-medium",
  sm: "rounded-pill border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]",
} as const;

const outcomeLabels: Record<AgreementOutcome, string> = {
  match: "Match",
  mismatch: "Mismatch",
  partial: "Partial",
};

const outcomeTones: Record<AgreementOutcome, Tone> = {
  match: "success",
  mismatch: "danger",
  partial: "warning",
};

const outcomeOrder: Record<AgreementOutcome, number> = {
  mismatch: 0,
  partial: 1,
  match: 2,
};

const rowGridClassName =
  "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]";

const baselineLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-pill border border-border bg-surface px-4 text-sm font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted";

export function getAgreementTone(agreement: SubmissionAgreement | null): Tone {
  if (!agreement || agreement.agreementPercentage === null) {
    return "neutral";
  }

  if (agreement.agreementPercentage >= 90) {
    return "success";
  }

  return agreement.agreementPercentage >= 70 ? "warning" : "danger";
}

export function formatAgreementLabel(comparison: SubmissionComparison) {
  if (!comparison.baseline) {
    return "Baseline deleted";
  }

  const { agreement } = comparison;

  if (!agreement || agreement.agreementPercentage === null) {
    return "No rows to compare";
  }

  return `${agreement.agreementPercentage}% agreement${
    agreement.basis === "unreviewed" ? " (unreviewed baseline)" : ""
  }`;
}

type SubmissionAgreementPillProps = {
  comparison: SubmissionComparison;
  size?: keyof typeof pillSizeClassNames;
};

export function SubmissionAgreementPill({
  comparison,
  size = "md",
}: SubmissionAgreementPillProps) {
  return (
    <span
      className={cn(
        pillSizeClassNames[size],
        toneClassNames[getAgreementTone(comparison.agreement)],
      )}
    >
      {formatAgreementLabel(comparison)}
    </span>
  );
}

function describeAgreement(agreement: SubmissionAgreement) {
  const outcomeSummary = `${agreement.matches} match, ${agreement.partialMatches} partial, ${agreement.mismatches} mismatch.`;

  if (agreement.basis === "unreviewed") {
    return `The baseline has not been reviewed yet, so this compares against its raw AI output across all ${agreement.compared} rows. Review the baseline to turn this into an accuracy signal. ${outcomeSummary}`;
  }

  return `Compared ${agreement.compared} of ${agreement.baselineTotalDecisions} baseline decisions that have been confirmed or corrected. ${outcomeSummary}`;
}

type SubmissionAgreementCardProps = {
  comparison: SubmissionComparison;
};

export function SubmissionAgreementCard({ comparison }: SubmissionAgreementCardProps) {
  const { agreement, baseline } = comparison;
  const sortedRows = agreement
    ? [...agreement.rows].sort(
        (left, right) => outcomeOrder[left.outcome] - outcomeOrder[right.outcome],
      )
    : [];
  const title = baseline
    ? agreement && agreement.agreementPercentage !== null
      ? `${agreement.agreementPercentage}% agreement with ${
          agreement.basis === "reviewed"
            ? "the reviewed baseline"
            : "the baseline's AI output"
        }`
      : "Nothing to compare yet"
    : "Baseline submission is no longer available";
  const description = baseline
    ? agreement && agreement.compared > 0
      ? describeAgreement(agreement)
      : "The baseline has no rows to compare against."
    : "This run was started from a submission that has since been deleted, so agreement cannot be calculated.";

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
            Model Comparison
          </p>
          <h3 className="text-2xl">{title}</h3>
          <p className="max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
        </div>
        {baseline ? (
          <AppLink
            className={baselineLinkClassName}
            href={`/submissions/${baseline.submissionId}`}
          >
            Open baseline ({baseline.model})
          </AppLink>
        ) : null}
      </div>

      {sortedRows.length > 0 ? (
        <div className="overflow-hidden rounded-control border border-border">
          <div
            className={cn(
              "hidden bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted md:grid md:gap-4",
              rowGridClassName,
            )}
          >
            <span>Row</span>
            <span>Baseline</span>
            <span>This run</span>
            <span>Outcome</span>
          </div>
          {sortedRows.map((row) => (
            <div
              key={`${row.kind}-${row.label}`}
              className={cn(
                "grid gap-2 border-t border-border px-4 py-3 text-sm md:items-center md:gap-4",
                rowGridClassName,
              )}
            >
              <span className="font-medium text-text">{row.label}</span>
              <span className="break-words text-text-muted">
                <span className="mr-2 text-xs uppercase tracking-[0.12em] text-text-muted md:hidden">
                  Baseline
                </span>
                {row.baselineValue}
              </span>
              <span className="break-words text-text">
                <span className="mr-2 text-xs uppercase tracking-[0.12em] text-text-muted md:hidden">
                  This run
                </span>
                {row.rerunValue}
              </span>
              <span
                className={cn(
                  "justify-self-start rounded-pill border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]",
                  toneClassNames[outcomeTones[row.outcome]],
                )}
              >
                {outcomeLabels[row.outcome]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
