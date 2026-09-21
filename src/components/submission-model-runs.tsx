import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { describeProviderRun } from "@/lib/ai/provider-meta";
import type { SubmissionModelRun } from "@/lib/submissions/types";

import {
  formatAgreementLabel,
  getAgreementTone,
} from "@/components/submission-agreement";

const toneClassNames = {
  danger: "border-danger-ring bg-danger-soft text-danger-strong",
  neutral: "border-border bg-surface-muted text-text-muted",
  success: "border-success-ring bg-success-soft text-success-strong",
  warning: "border-warning-ring bg-warning-soft text-warning-strong",
} as const;

const runLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-pill border border-border bg-surface px-4 text-sm font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted";

const runGridClassName =
  "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type SubmissionModelRunsProps = {
  currentSubmissionId: string;
  runs: SubmissionModelRun[];
};

export function SubmissionModelRuns({
  currentSubmissionId,
  runs,
}: SubmissionModelRunsProps) {
  if (runs.length < 2) {
    return null;
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
          Model Comparison
        </p>
        <h3 className="text-2xl">Model runs on this datasheet</h3>
        <p className="max-w-3xl text-sm leading-6 text-text-muted">
          Every run below used the same PDF and requested fields. Agreement is
          measured against the baseline&apos;s reviewed values, or against its raw
          output until it has been reviewed.
        </p>
      </div>

      <div className="grid gap-3">
        {runs.map((run) => {
          const description = describeProviderRun(run.providerMeta);
          const isCurrent = run.submissionId === currentSubmissionId;
          const agreementTone = run.isBaseline ? "neutral" : getAgreementTone(run.agreement);
          const agreementLabel = run.isBaseline
            ? run.reviewStatus === "reviewed"
              ? "Baseline · reviewed"
              : "Baseline · pending review"
            : run.agreement
              ? formatAgreementLabel({
                  agreement: run.agreement,
                  baseline: {
                    model: "",
                    partNumber: "",
                    reviewStatus: run.agreement.baselineReviewStatus,
                    submissionId: "",
                  },
                  baselineSubmissionId: "",
                })
              : "Baseline deleted";

          return (
            <div
              key={run.submissionId}
              className={cn(
                "grid gap-3 rounded-control border bg-surface-muted p-4 lg:items-center lg:gap-4",
                runGridClassName,
                isCurrent ? "border-border-strong" : "border-border",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{description.modelLabel}</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  {formatDateTime(run.createdAt)}
                </p>
              </div>
              <div className="text-sm leading-6 text-text-muted">
                {description.tokens ? <p>{description.tokens}</p> : null}
                {description.performance ? <p>{description.performance}</p> : null}
                {!description.tokens && !description.performance ? (
                  <p>No usage recorded</p>
                ) : null}
              </div>
              <div>
                <span
                  className={cn(
                    "inline-flex rounded-pill border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]",
                    toneClassNames[agreementTone],
                  )}
                >
                  {agreementLabel}
                </span>
              </div>
              <div className="lg:justify-self-end">
                {isCurrent ? (
                  <span className="inline-flex h-10 items-center rounded-pill border border-transparent px-4 text-sm font-medium text-text-muted">
                    Viewing
                  </span>
                ) : (
                  <AppLink
                    className={runLinkClassName}
                    href={`/submissions/${run.submissionId}`}
                  >
                    Open run
                  </AppLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
