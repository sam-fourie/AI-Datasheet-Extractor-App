"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { deriveSubmissionAccuracyBucket } from "@/lib/submissions/review";
import type {
  SubmissionAccuracyBucket,
  SubmissionSummary,
} from "@/lib/submissions/types";

const reviewToneClassNames = {
  pending: "border-warning-ring bg-warning-soft text-warning-strong",
  reviewed: "border-success-ring bg-success-soft text-success-strong",
} as const;

const detailLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-pill border border-border bg-surface px-4 text-sm font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted";

type DeleteSubmissionResponse = {
  error?: string;
  submissionId?: string;
  success?: boolean;
};

type OverviewMetricCardProps = {
  description?: string;
  title: string;
  value: number;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatReviewStatus(reviewStatus: "pending" | "reviewed") {
  return reviewStatus === "reviewed" ? "Reviewed" : "Pending review";
}

function formatSourceMode(sourceMode: "upload" | "url") {
  return sourceMode === "upload" ? "Uploaded PDF" : "PDF URL";
}

function OverviewMetricCard({
  description,
  title,
  value,
}: OverviewMetricCardProps) {
  return (
    <div className="rounded-control border border-border bg-surface-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function SubmissionsArchive({
  initialSubmissions,
}: {
  initialSubmissions: SubmissionSummary[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submissionPendingDeletion, setSubmissionPendingDeletion] =
    useState<SubmissionSummary | null>(null);

  const pendingReviewCount = submissions.filter(
    (submission) => submission.reviewStatus === "pending",
  ).length;
  const reviewedAccuracyCounts = submissions.reduce<
    Record<SubmissionAccuracyBucket, number>
  >(
    (counts, submission) => {
      const accuracyBucket = deriveSubmissionAccuracyBucket(submission);

      if (accuracyBucket) {
        counts[accuracyBucket] += 1;
      }

      return counts;
    },
    {
      belowThreshold: 0,
      mostlyCorrect: 0,
      perfect: 0,
    },
  );

  function openDeleteDialog(submission: SubmissionSummary) {
    setDeleteError(null);
    setSubmissionPendingDeletion(submission);
  }

  function closeDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setDeleteError(null);
    setSubmissionPendingDeletion(null);
  }

  async function handleDeleteSubmission() {
    if (!submissionPendingDeletion) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/submissions/${submissionPendingDeletion.submissionId}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | DeleteSubmissionResponse
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || "Could not delete the submission.",
        );
      }

      startTransition(() => {
        setSubmissions((current) =>
          current.filter(
            (submission) =>
              submission.submissionId !==
              submissionPendingDeletion.submissionId,
          ),
        );
        setSubmissionPendingDeletion(null);
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete the submission.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    if (!submissionPendingDeletion) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        setDeleteError(null);
        setSubmissionPendingDeletion(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleting, submissionPendingDeletion]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewMetricCard title="Total submissions" value={submissions.length} />
        <OverviewMetricCard title="Pending review" value={pendingReviewCount} />
        <OverviewMetricCard
          description="Reviewed submissions only"
          title="100% correct"
          value={reviewedAccuracyCounts.perfect}
        />
        <OverviewMetricCard
          description="Reviewed submissions only"
          title="80-99% correct"
          value={reviewedAccuracyCounts.mostlyCorrect}
        />
        <OverviewMetricCard
          description="Reviewed submissions only"
          title="<80% correct"
          value={reviewedAccuracyCounts.belowThreshold}
        />
      </div>

      {submissions.length > 0 ? (
        <div className="grid gap-4">
          {submissions.map((submission) => (
            <Card key={submission.submissionId} className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-pill border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]",
                        reviewToneClassNames[submission.reviewStatus],
                      ].join(" ")}
                    >
                      {formatReviewStatus(submission.reviewStatus)}
                    </span>
                    <span className="rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                      {submission.reviewDecisionCounts.pending} pending decisions
                    </span>
                    <span className="rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                      {submission.providerMeta.model}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl">{submission.intake.partNumber}</h3>
                    <p className="text-sm leading-6 text-text-muted">
                      {submission.intake.packageCategory} •{" "}
                      {formatSourceMode(submission.intake.sourceMode)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    className={detailLinkClassName}
                    href={`/submissions/${submission.submissionId}`}
                  >
                    Open review
                  </Link>
                  <Button
                    disabled={isDeleting}
                    onClick={() => openDeleteDialog(submission)}
                    size="sm"
                    variant="danger"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Source
                  </p>
                  <p className="mt-2 break-all text-sm font-medium text-text">
                    {submission.intake.sourceLabel}
                  </p>
                </div>
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Requested fields
                  </p>
                  <p className="mt-2 text-sm font-medium text-text">
                    {submission.intake.requestedFields.length}
                  </p>
                </div>
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Created
                  </p>
                  <p className="mt-2 text-sm font-medium text-text">
                    {formatDateTime(submission.createdAt)}
                  </p>
                </div>
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Last updated
                  </p>
                  <p className="mt-2 text-sm font-medium text-text">
                    {formatDateTime(submission.updatedAt)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="space-y-4">
          <h3 className="text-2xl">No submissions yet</h3>
          <p className="text-sm leading-6 text-text-muted">
            Run an extraction from the intake workbench to create the first saved
            submission and unlock the review queue.
          </p>
          <div>
            <Link className={detailLinkClassName} href="/">
              Go to workbench
            </Link>
          </div>
        </Card>
      )}

      {submissionPendingDeletion ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6 py-8 backdrop-blur-sm"
          onClick={closeDeleteDialog}
        >
          <Card
            aria-describedby="submission-delete-dialog-description"
            aria-labelledby="submission-delete-dialog-title"
            aria-modal="true"
            className="w-full max-w-lg space-y-5 p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                Delete submission
              </p>
              <h2 id="submission-delete-dialog-title" className="text-2xl">
                Delete {submissionPendingDeletion.intake.partNumber}?
              </h2>
              <p
                id="submission-delete-dialog-description"
                className="text-sm leading-6 text-text-muted"
              >
                This will permanently remove the saved submission and its review
                history from the archive.
              </p>
            </div>

            {deleteError ? (
              <div className="rounded-control border border-danger-ring bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-strong">
                {deleteError}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                disabled={isDeleting}
                onClick={closeDeleteDialog}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDeleteSubmission}
                variant="danger"
              >
                {isDeleting ? "Deleting..." : "Yes, delete"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
