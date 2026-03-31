"use client";

import { Check, Clock3, X } from "lucide-react";
import { startTransition, useState } from "react";

import { AppLink } from "@/components/app-link";
import {
  Button,
  Card,
  Field,
  TextField,
  Textarea,
} from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type {
  ConfidenceLevel,
  MeasurementFieldStatus,
} from "@/lib/package-categories";
import {
  countReviewDecisions,
  deriveSubmissionAccuracyBucket,
  deriveSubmissionAccuracyPercentage,
  hasStartedSubmissionReview,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import { getSubmissionPdfPath } from "@/lib/submissions/source";
import type {
  MeasurementReview,
  PinReview,
  ReviewDecisionStatus,
  SubmissionAccuracyBucket,
  SubmissionDetail,
  SubmissionReviewPayload,
  SubmissionReviewStatus,
} from "@/lib/submissions/types";

type SubmissionReviewEditorProps = {
  initialSubmission: SubmissionDetail;
  mode?: "detail" | "live";
};

type ReviewSaveError = {
  error?: string;
};

type DecisionOption = {
  icon: "check" | "clock" | "x";
  label: string;
  value: ReviewDecisionStatus;
};

const decisionOptions: DecisionOption[] = [
  {
    label: "Pending",
    icon: "clock",
    value: "pending",
  },
  {
    label: "Confirmed",
    icon: "check",
    value: "confirmed",
  },
  {
    label: "Incorrect",
    icon: "x",
    value: "corrected",
  },
];

type SemanticTone = "danger" | "neutral" | "success" | "warning";

const badgeToneClassNames: Record<SemanticTone, string> = {
  success: "border-success-ring bg-success-soft text-success-strong",
  warning: "border-warning-ring bg-warning-soft text-warning-strong",
  danger: "border-danger-ring bg-danger-soft text-danger-strong",
  neutral: "border-border bg-surface-muted text-text-muted",
};

const textToneClassNames: Record<SemanticTone, string> = {
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger-strong",
  neutral: "text-text-muted",
};

const accuracyToneClassNames: Record<SubmissionAccuracyBucket, string> = {
  perfect: badgeToneClassNames.success,
  mostlyCorrect: badgeToneClassNames.warning,
  belowThreshold: badgeToneClassNames.danger,
};

const actionLinkClassName =
  "inline-flex h-11 items-center justify-center rounded-pill border border-border bg-surface px-5 text-[15px] font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted";

const measurementDesktopColumnWidths = ["16%", "28%", "16%", "22%", "18%"];
const measurementSummaryColumnWidths = ["50%", "50%"];
const pinDesktopColumnWidths = ["34%", "16%", "30%", "20%"];
const pinSummaryColumnWidths = ["100%"];

function createReviewPayloadFromSubmission(
  submission: SubmissionDetail,
): SubmissionReviewPayload {
  return {
    measurements: submission.review.measurements.map((entry) => ({ ...entry })),
    packageSelection: { ...submission.review.packageSelection },
    pins: submission.review.pins.map((entry) => ({ ...entry })),
    reviewerNotes: submission.review.reviewerNotes,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConfidence(confidence?: ConfidenceLevel) {
  if (!confidence) {
    return "Unknown confidence";
  }

  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`;
}

function formatEvidencePages(evidencePages?: number[]) {
  if (!evidencePages || evidencePages.length === 0) {
    return "No page references";
  }

  return `Pages ${evidencePages.join(", ")}`;
}

function formatReviewStatus(reviewStatus: SubmissionReviewStatus) {
  return reviewStatus === "reviewed" ? "Reviewed" : "Pending review";
}

function formatSourceMode(sourceMode: SubmissionDetail["intake"]["sourceMode"]) {
  return sourceMode === "upload" ? "Uploaded PDF" : "PDF URL";
}

function getDerivedReviewStatus(
  pendingDecisions: number,
): SubmissionReviewStatus {
  return pendingDecisions === 0 ? "reviewed" : "pending";
}

function getConfidenceTone(confidence?: ConfidenceLevel): SemanticTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "warning";
  }

  if (confidence === "low") {
    return "danger";
  }

  return "neutral";
}

function getMeasurementStatusTone(status: MeasurementFieldStatus): SemanticTone {
  if (status === "Extracted") {
    return "success";
  }

  if (status === "Needs review") {
    return "warning";
  }

  return "danger";
}

function getDecisionTone(status: ReviewDecisionStatus): SemanticTone {
  if (status === "confirmed") {
    return "success";
  }

  if (status === "corrected") {
    return "danger";
  }

  return "warning";
}

function getDecisionLabel(status: ReviewDecisionStatus) {
  return (
    decisionOptions.find((option) => option.value === status)?.label ?? "Pending"
  );
}

function getSelectedDecisionClassName(status: ReviewDecisionStatus) {
  if (status === "confirmed") {
    return "!border-success-ring !bg-success-soft !text-success-strong hover:!border-success-ring hover:!bg-success-soft hover:!text-success-strong";
  }

  if (status === "corrected") {
    return "!border-danger-ring !bg-danger-soft !text-danger-strong hover:!border-danger-ring hover:!bg-danger-soft hover:!text-danger-strong";
  }

  return "!border-warning-ring !bg-warning-soft !text-warning-strong hover:!border-warning-ring hover:!bg-warning-soft hover:!text-warning-strong";
}

function getReviewDraftError(review: SubmissionReviewPayload) {
  if (
    review.packageSelection.status === "corrected" &&
    !review.packageSelection.correctedSelectedPackage?.trim()
  ) {
    return "Provide the corrected package selection before saving.";
  }

  const invalidMeasurement = review.measurements.find(
    (entry) => entry.status === "corrected" && !entry.correctedValue?.trim(),
  );

  if (invalidMeasurement) {
    return `Provide the corrected measurement value for ${invalidMeasurement.field}.`;
  }

  const invalidPin = review.pins.find(
    (entry) =>
      entry.status === "corrected" &&
      (!entry.correctedPinNumber?.trim() || !entry.correctedPinName?.trim()),
  );

  if (invalidPin) {
    return `Provide the corrected pin number and name for pin row ${invalidPin.pinIndex + 1}.`;
  }

  return null;
}

function toIdFragment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function DecisionPillGroup({
  onChange,
  status,
}: {
  onChange: (nextStatus: ReviewDecisionStatus) => void;
  status: ReviewDecisionStatus;
}) {
  return (
    <div className="min-w-0 flex flex-wrap gap-2">
      {decisionOptions.map((option) => {
        const isSelected = status === option.value;

        return (
          <Button
            key={option.value}
            aria-label={option.label}
            aria-pressed={isSelected}
            className={cn(
              "h-11 w-11 px-0 text-xs font-semibold",
              isSelected
                ? cn(
                    getSelectedDecisionClassName(option.value),
                    "shadow-soft ring-1 ring-inset ring-current/10",
                  )
                : "border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-muted hover:text-text",
            )}
            onClick={() => onChange(option.value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {option.icon === "clock" ? (
              <Clock3
                aria-hidden="true"
                className="size-6 shrink-0"
                strokeWidth={2.3}
              />
            ) : null}
            {option.icon === "check" ? (
              <Check
                aria-hidden="true"
                className="size-6 shrink-0"
                strokeWidth={2.6}
              />
            ) : null}
            {option.icon === "x" ? (
              <X
                aria-hidden="true"
                className="size-6 shrink-0"
                strokeWidth={2.6}
              />
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

function DecisionStatusBadge({
  className,
  status,
}: {
  className?: string;
  status: ReviewDecisionStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-pill border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]",
        badgeToneClassNames[getDecisionTone(status)],
        className,
      )}
    >
      {getDecisionLabel(status)}
    </span>
  );
}

function PlaceholderText({ children }: { children: string }) {
  return <span className="text-sm text-text-muted">{children}</span>;
}

function ReadOnlyText({
  className,
  emptyLabel,
  preserveWhitespace = false,
  value,
}: {
  className?: string;
  emptyLabel: string;
  preserveWhitespace?: boolean;
  value?: string;
}) {
  if (!value) {
    return <PlaceholderText>{emptyLabel}</PlaceholderText>;
  }

  return (
    <p
      className={cn(
        "break-words text-sm leading-6 text-text",
        preserveWhitespace ? "whitespace-pre-wrap" : undefined,
        className,
      )}
    >
      {value}
    </p>
  );
}

function TableHeaderCell({ children }: { children: string }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-muted"
    >
      {children}
    </th>
  );
}

function MeasurementStatusSummary({
  confidence,
  status,
}: {
  confidence?: ConfidenceLevel;
  status: MeasurementFieldStatus;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <span
        className={[
          "rounded-pill border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]",
          badgeToneClassNames[getMeasurementStatusTone(status)],
        ].join(" ")}
      >
        {status}
      </span>
      <span
        className={[
          "text-xs font-medium",
          textToneClassNames[getConfidenceTone(confidence)],
        ].join(" ")}
      >
        {formatConfidence(confidence)}
      </span>
    </div>
  );
}

export function SubmissionReviewEditor({
  initialSubmission,
  mode = "detail",
}: SubmissionReviewEditorProps) {
  const [submission, setSubmission] = useState(initialSubmission);
  const [reviewDraft, setReviewDraft] = useState<SubmissionReviewPayload>(() =>
    createReviewPayloadFromSubmission(initialSubmission),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const savedReviewPayload = createReviewPayloadFromSubmission(submission);
  const savedReviewHasStarted = hasStartedSubmissionReview(submission.review);
  const displayedReview = isEditing ? reviewDraft : savedReviewPayload;
  const normalizedDisplayedReview = normalizeSubmissionReview(
    submission.extraction,
    displayedReview,
  );
  const reviewDecisionCounts = countReviewDecisions(normalizedDisplayedReview);
  const draftReviewStatus = getDerivedReviewStatus(reviewDecisionCounts.pending);
  const accuracyBucket =
    mode === "detail"
      ? deriveSubmissionAccuracyBucket({
          reviewDecisionCounts,
          reviewStatus: draftReviewStatus,
        })
      : null;
  const accuracyPercentage =
    mode === "detail"
      ? deriveSubmissionAccuracyPercentage({
          reviewDecisionCounts,
          reviewStatus: draftReviewStatus,
        })
      : null;
  const measurementReviewMap = new Map(
    displayedReview.measurements.map((entry) => [entry.field, entry] as const),
  );
  const pinReviewMap = new Map(
    displayedReview.pins.map((entry) => [entry.pinIndex, entry] as const),
  );
  const trimmedPartNumber = submission.intake.partNumber.trim();
  const isDirty =
    JSON.stringify(reviewDraft) !== JSON.stringify(savedReviewPayload);
  const draftError = getReviewDraftError(reviewDraft);
  const pendingDecisionLabel = `${reviewDecisionCounts.pending} pending decision${
    reviewDecisionCounts.pending === 1 ? "" : "s"
  }`;
  const submissionPdfPath = getSubmissionPdfPath(
    submission.submissionId,
    submission.intake.sourceMeta,
  );
  const showReviewFields = isEditing || savedReviewHasStarted;
  const showPreReviewExtractionLayout = !showReviewFields;
  const reviewActionLabel = savedReviewHasStarted ? "Update review" : "Start review";
  const heading =
    mode === "live"
      ? {
          editingDescription:
            "Review each row inline, add reviewer notes, and save the latest human corrections here.",
          eyebrow: "Extraction Result",
          startedDescription:
            "The latest saved human review is shown below. Click Update review to change reviewer notes, decisions, or corrections.",
          title: "Live extraction output",
          untouchedDescription:
            "The extraction has already been persisted. Review the AI output below, then click Start review when you want to capture human decisions.",
        }
      : {
          editingDescription:
            "Review the stored extraction snapshot, confirm the correct values, and save human corrections without changing the original AI output.",
          eyebrow: "Submission Review",
          startedDescription:
            "The latest saved human review is shown below. Click Update review to revise reviewer notes, decisions, or corrections.",
          title: trimmedPartNumber
            ? `Review ${trimmedPartNumber} submission`
            : "Review submission",
          untouchedDescription:
            "Review the stored extraction snapshot first, then click Start review when you want to add human corrections without changing the immutable AI output.",
        };
  const headingDescription = isEditing
    ? heading.editingDescription
    : savedReviewHasStarted
      ? heading.startedDescription
      : heading.untouchedDescription;
  const reviewNotesTitle = isEditing
    ? "Capture reviewer context"
    : showReviewFields
      ? "Review context"
      : "AI review context";
  const reviewNotesDescription = isEditing
    ? "Submission review status is derived automatically from the package, measurement, and pin decisions below."
    : showReviewFields
      ? "Saved reviewer notes are shown alongside the model's review guidance."
      : "Review the model's notes first, then start review when you want to capture human decisions.";
  const packageSelectionTitle = isEditing
    ? "Confirm or correct the package variant"
    : showReviewFields
      ? "Saved package review"
      : "AI package selection";
  const measurementsTitle = isEditing
    ? "Confirm or correct extracted measurements"
    : showReviewFields
      ? "Saved measurement review"
      : "Extracted measurements";
  const pinsTitle = isEditing
    ? "Confirm or correct extracted pin rows"
    : showReviewFields
      ? "Saved pin review"
      : "Extracted pin rows";
  const actionStateTone: SemanticTone = draftError
    ? "warning"
    : saveError
      ? "danger"
      : saveMessage
        ? "success"
        : isDirty
          ? "warning"
          : savedReviewHasStarted
            ? "success"
            : "neutral";
  const actionStateTitle = draftError
    ? "Save blocked"
    : saveError
      ? "Could not save review"
      : saveMessage
        ? "Review saved"
        : isDirty
          ? "Unsaved changes"
          : savedReviewHasStarted
            ? "All changes saved"
            : "Review not started";
  const actionStateMessage = draftError
    ? draftError
    : saveError
      ? saveError
      : saveMessage
        ? reviewDecisionCounts.pending === 0
          ? "Latest corrections are saved and every review decision is complete."
          : `Latest corrections are saved. ${pendingDecisionLabel} remain.`
        : isDirty
          ? "Review edits stay local until you save them."
          : savedReviewHasStarted
            ? reviewDecisionCounts.pending === 0
              ? "All review decisions are complete."
              : `${pendingDecisionLabel} remain before the review is complete.`
            : "Select decisions and add notes, then save the review when you are ready.";

  function resetFeedback() {
    setSaveError(null);
    setSaveMessage(null);
  }

  function beginDraftUpdate() {
    resetFeedback();
  }

  function handleEnterEditMode() {
    resetFeedback();
    setReviewDraft(savedReviewPayload);
    setIsEditing(true);
  }

  function handleCancel() {
    if (isSaving) {
      return;
    }

    resetFeedback();
    setReviewDraft(savedReviewPayload);
    setIsEditing(false);
  }

  function updateReviewerNotes(nextReviewerNotes: string) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      reviewerNotes: nextReviewerNotes,
    }));
  }

  function updatePackageSelectionStatus(nextStatus: ReviewDecisionStatus) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      packageSelection:
        nextStatus === "corrected"
          ? {
              correctionNote: current.packageSelection.correctionNote ?? "",
              correctedSelectedPackage:
                current.packageSelection.correctedSelectedPackage ?? "",
              status: "corrected",
            }
          : {
              ...current.packageSelection,
              status: nextStatus,
            },
    }));
  }

  function updatePackageSelectionCorrection(patch: {
    correctionNote?: string;
    correctedSelectedPackage?: string;
  }) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      packageSelection: {
        ...current.packageSelection,
        ...patch,
        status: "corrected",
      },
    }));
  }

  function updateMeasurementStatus(
    field: string,
    nextStatus: ReviewDecisionStatus,
  ) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      measurements: current.measurements.map((entry) => {
        if (entry.field !== field) {
          return entry;
        }

        if (nextStatus === "corrected") {
          return {
            correctionNote: entry.correctionNote ?? "",
            correctedValue: entry.correctedValue ?? "",
            field,
            status: "corrected",
          };
        }

        return {
          ...entry,
          field,
          status: nextStatus,
        };
      }),
    }));
  }

  function updateMeasurementCorrection(
    field: string,
    patch: Partial<MeasurementReview>,
  ) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      measurements: current.measurements.map((entry) =>
        entry.field === field
          ? {
              ...entry,
              ...patch,
              field,
              status: "corrected",
            }
          : entry,
      ),
    }));
  }

  function updatePinStatus(pinIndex: number, nextStatus: ReviewDecisionStatus) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      pins: current.pins.map((entry) => {
        if (entry.pinIndex !== pinIndex) {
          return entry;
        }

        if (nextStatus === "corrected") {
          return {
            correctionNote: entry.correctionNote ?? "",
            correctedPinName: entry.correctedPinName ?? "",
            correctedPinNumber: entry.correctedPinNumber ?? "",
            pinIndex,
            status: "corrected",
          };
        }

        return {
          ...entry,
          pinIndex,
          status: nextStatus,
        };
      }),
    }));
  }

  function updatePinCorrection(pinIndex: number, patch: Partial<PinReview>) {
    beginDraftUpdate();
    setReviewDraft((current) => ({
      ...current,
      pins: current.pins.map((entry) =>
        entry.pinIndex === pinIndex
          ? {
              ...entry,
              ...patch,
              pinIndex,
              status: "corrected",
            }
          : entry,
      ),
    }));
  }

  async function handleSave() {
    if (draftError || !isDirty) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const response = await fetch(
        `/api/submissions/${submission.submissionId}/review`,
        {
          body: JSON.stringify(reviewDraft),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | SubmissionDetail
        | ReviewSaveError
        | null;

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "Could not save the review."
            : "Could not save the review.",
        );
      }

      const nextSubmission = payload as SubmissionDetail;

      startTransition(() => {
        setSubmission(nextSubmission);
        setReviewDraft(createReviewPayloadFromSubmission(nextSubmission));
        setIsEditing(false);
      });
      setSaveMessage("Review saved.");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save the review.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn("space-y-6", isEditing ? "pb-44 md:pb-36" : "pb-8")}>
      <Card className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
              {heading.eyebrow}
            </p>
            <h2 className="text-3xl">{heading.title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-text-muted">
              {headingDescription}
            </p>
          </div>

          <div
            className={cn(
              "flex flex-wrap gap-3",
              mode === "live" ? "ml-auto justify-end" : undefined,
            )}
          >
            {!isEditing ? (
              <Button onClick={handleEnterEditMode}>{reviewActionLabel}</Button>
            ) : null}
            {mode === "live" ? (
              <AppLink
                className={actionLinkClassName}
                href={`/submissions/${submission.submissionId}`}
              >
                Open saved submission
              </AppLink>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-pill border px-4 py-2 text-sm font-medium",
              badgeToneClassNames[
                draftReviewStatus === "reviewed" ? "success" : "warning"
              ],
            ].join(" ")}
          >
            {formatReviewStatus(draftReviewStatus)}
          </span>
          {reviewDecisionCounts.pending > 0 ? (
            <span className="rounded-pill border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-text-muted">
              {pendingDecisionLabel}
            </span>
          ) : mode === "detail" &&
            accuracyBucket &&
            accuracyPercentage !== null ? (
            <span
              className={cn(
                "rounded-pill border px-4 py-2 text-sm font-medium",
                accuracyToneClassNames[accuracyBucket],
              )}
            >
              {accuracyPercentage}% accurate
            </span>
          ) : null}
          <span className="rounded-pill border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-text-muted">
            {submission.providerMeta.model}
          </span>
          {submission.extraction.review.needsReview ? (
            <span
              className={[
                "rounded-pill border px-4 py-2 text-sm font-medium",
                badgeToneClassNames.warning,
              ].join(" ")}
            >
              AI flagged review
            </span>
          ) : null}
        </div>

        {saveMessage && !isEditing ? (
          <div
            aria-live="polite"
            className="rounded-control border border-success-ring bg-success-soft px-4 py-3"
            role="status"
          >
            <p className="text-sm font-medium text-success-strong">
              {saveMessage}
            </p>
            <p className="text-sm leading-6 text-success-strong">
              {reviewDecisionCounts.pending === 0
                ? "Saved review is complete."
                : `Saved review updated. ${pendingDecisionLabel} remain.`}
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-control border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Part Number
            </p>
            <p className="mt-2 break-all text-sm font-medium text-text">
              {submission.intake.partNumber}
            </p>
          </div>
          <div className="rounded-control border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Package Category
            </p>
            <p className="mt-2 text-sm font-medium text-text">
              {submission.intake.packageCategory}
            </p>
          </div>
          <div className="rounded-control border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Source Mode
            </p>
            <p className="mt-2 text-sm font-medium text-text">
              {formatSourceMode(submission.intake.sourceMode)}
            </p>
            <p className="mt-2 break-all text-xs leading-5 text-text-muted">
              {submission.intake.sourceLabel}
            </p>
            {submissionPdfPath ? (
              <div className="mt-3">
                <a
                  className={actionLinkClassName}
                  href={submissionPdfPath}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open PDF
                </a>
              </div>
            ) : null}
          </div>
          <div className="rounded-control border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Timeline
            </p>
            <p className="mt-2 text-sm font-medium text-text">
              Created {formatDateTime(submission.createdAt)}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              Updated {formatDateTime(submission.updatedAt)}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
              Review Notes
            </p>
            <h3 className="text-2xl">{reviewNotesTitle}</h3>
            <p className="text-sm leading-6 text-text-muted">
              {reviewNotesDescription}
            </p>
          </div>

          <div
            className={cn(
              "grid gap-4 lg:items-start",
              showReviewFields ? "lg:grid-cols-2" : undefined,
            )}
          >
            {showReviewFields ? (
              isEditing ? (
                <Field
                  hint="Use reviewer notes for anything the per-row corrections did not capture."
                  htmlFor="submission-reviewer-notes"
                  label="Reviewer notes"
                >
                  <Textarea
                    className="min-h-56"
                    id="submission-reviewer-notes"
                    onChange={(event) => {
                      const nextReviewerNotes = event.currentTarget.value;
                      updateReviewerNotes(nextReviewerNotes);
                    }}
                    placeholder="Add any manual review notes or rationale."
                    rows={6}
                    value={reviewDraft.reviewerNotes}
                  />
                </Field>
              ) : (
                <div className="rounded-control border border-border bg-surface-muted p-4 lg:h-full">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Reviewer notes
                  </p>
                  <div className="mt-2">
                    <ReadOnlyText
                      emptyLabel="No reviewer notes added."
                      preserveWhitespace
                      value={displayedReview.reviewerNotes}
                    />
                  </div>
                </div>
              )
            ) : null}

            <div className="rounded-control border border-border bg-surface-muted p-4 lg:h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                AI review notes
              </p>
              <p className="mt-2 text-sm font-medium text-text">
                {submission.extraction.review.needsReview
                  ? "The model recommended manual review."
                  : "The model did not raise a manual review flag."}
              </p>
              {submission.extraction.review.notes.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {submission.extraction.review.notes.map((note) => (
                    <p key={note} className="text-sm leading-6 text-text-muted">
                      {note}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  No additional AI review notes were returned.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                Package Selection
              </p>
              <h3 className="text-2xl">{packageSelectionTitle}</h3>
            </div>
            {showReviewFields ? (
              <DecisionStatusBadge status={displayedReview.packageSelection.status} />
            ) : null}
          </div>

          <div className="rounded-control border border-border bg-surface p-5">
            <div
              className={cn(
                "grid gap-5 lg:items-start",
                showReviewFields
                  ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]"
                  : undefined,
              )}
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    AI selection
                  </p>
                  <p className="mt-2 text-sm font-medium text-text">
                    {submission.extraction.packageSelection.selectedPackage}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "rounded-pill border px-3 py-1 text-xs font-medium",
                      badgeToneClassNames[
                        getConfidenceTone(
                          submission.extraction.packageSelection.confidence,
                        )
                      ],
                    ].join(" ")}
                  >
                    {formatConfidence(
                      submission.extraction.packageSelection.confidence,
                    )}
                  </span>
                </div>
                {submission.extraction.packageSelection.alternatives.length > 0 ? (
                  <p className="text-xs leading-5 text-text-muted">
                    Alternatives considered:{" "}
                    {submission.extraction.packageSelection.alternatives.join(", ")}
                  </p>
                ) : null}
              </div>

              {showReviewFields ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                      Decision
                    </p>
                    <div className="mt-3">
                      {isEditing ? (
                        <DecisionPillGroup
                          onChange={updatePackageSelectionStatus}
                          status={displayedReview.packageSelection.status}
                        />
                      ) : (
                        <DecisionStatusBadge
                          className="px-4 py-2 text-sm tracking-[0.12em]"
                          status={displayedReview.packageSelection.status}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {showReviewFields &&
            displayedReview.packageSelection.status === "corrected" ? (
              <div className="mt-5 rounded-control border border-border bg-surface-muted p-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                      Correction details
                    </p>
                    <p className="text-sm leading-6 text-text-muted">
                      Save the correct package variant and, if useful, add a short
                      note explaining the change.
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field
                        htmlFor="corrected-package-selection"
                        label="Corrected package"
                      >
                        <TextField
                          aria-label="Corrected package selection"
                          id="corrected-package-selection"
                          onChange={(event) => {
                            const correctedSelectedPackage =
                              event.currentTarget.value;

                            updatePackageSelectionCorrection({
                              correctedSelectedPackage,
                            });
                          }}
                          placeholder="Enter the correct package variant"
                          value={
                            displayedReview.packageSelection
                              .correctedSelectedPackage ?? ""
                          }
                        />
                      </Field>

                      <Field
                        htmlFor="corrected-package-note"
                        label="Package note"
                      >
                        <TextField
                          aria-label="Package correction note"
                          id="corrected-package-note"
                          onChange={(event) => {
                            const correctionNote = event.currentTarget.value;

                            updatePackageSelectionCorrection({
                              correctionNote,
                            });
                          }}
                          placeholder="Optional note"
                          value={displayedReview.packageSelection.correctionNote ?? ""}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Corrected package
                        </p>
                        <ReadOnlyText
                          className="font-medium"
                          emptyLabel="No correction"
                          value={
                            displayedReview.packageSelection
                              .correctedSelectedPackage
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Package note
                        </p>
                        <ReadOnlyText
                          emptyLabel="No note"
                          value={displayedReview.packageSelection.correctionNote}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div
        className={cn(
          "space-y-6",
          showPreReviewExtractionLayout
            ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
            : undefined,
        )}
      >
        <Card className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                Measurements
              </p>
              <h3 className="text-2xl">{measurementsTitle}</h3>
            </div>
            <span className="rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
              {submission.extraction.fields.length} measurement fields
            </span>
          </div>

          <div className="hidden overflow-hidden rounded-control border border-border bg-surface lg:block">
            <table className="min-w-full table-fixed border-collapse">
              <colgroup>
                {(showReviewFields
                  ? measurementDesktopColumnWidths
                  : measurementSummaryColumnWidths
                ).map((width, index) => (
                  <col key={`measurement-column-${index}`} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-surface-muted">
                <tr>
                  <TableHeaderCell>Field</TableHeaderCell>
                  <TableHeaderCell>AI output</TableHeaderCell>
                  {showReviewFields ? (
                    <>
                      <TableHeaderCell>Decision</TableHeaderCell>
                      <TableHeaderCell>Corrected output</TableHeaderCell>
                      <TableHeaderCell>Note</TableHeaderCell>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {submission.extraction.fields.map((field) => {
                  const review = measurementReviewMap.get(field.field) ?? {
                    field: field.field,
                    status: "pending" as const,
                  };
                  const isIncorrect = review.status === "corrected";
                  const fieldIdFragment = toIdFragment(field.field);

                  return (
                    <tr key={field.field} className="border-t border-border">
                      <td className="break-words px-4 py-4 align-top text-sm font-semibold text-text">
                        {field.field}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="min-w-0 space-y-2">
                          <MeasurementStatusSummary
                            confidence={field.confidence}
                            status={field.status}
                          />
                          <p className="break-words text-sm font-medium text-text">
                            {field.value}
                          </p>
                          <p className="text-xs leading-5 text-text-muted">
                            {formatEvidencePages(field.evidencePages)}
                          </p>
                        </div>
                      </td>
                      {showReviewFields ? (
                        <>
                          <td className="px-4 py-4 align-top">
                            {isEditing ? (
                              <DecisionPillGroup
                                onChange={(nextStatus) =>
                                  updateMeasurementStatus(field.field, nextStatus)
                                }
                                status={review.status}
                              />
                            ) : (
                              <DecisionStatusBadge status={review.status} />
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            {isIncorrect ? (
                              isEditing ? (
                                <TextField
                                  aria-label={`Corrected value for ${field.field}`}
                                  className="min-w-0"
                                  id={`measurement-value-${fieldIdFragment}`}
                                  onChange={(event) => {
                                    const correctedValue =
                                      event.currentTarget.value;

                                    updateMeasurementCorrection(field.field, {
                                      correctedValue,
                                    });
                                  }}
                                  placeholder="Enter corrected value"
                                  value={review.correctedValue ?? ""}
                                />
                              ) : (
                                <ReadOnlyText
                                  className="font-medium"
                                  emptyLabel="No correction"
                                  value={review.correctedValue}
                                />
                              )
                            ) : (
                              <PlaceholderText>No correction</PlaceholderText>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            {isIncorrect ? (
                              isEditing ? (
                                <TextField
                                  aria-label={`Correction note for ${field.field}`}
                                  className="min-w-0"
                                  id={`measurement-note-${fieldIdFragment}`}
                                  onChange={(event) => {
                                    const correctionNote =
                                      event.currentTarget.value;

                                    updateMeasurementCorrection(field.field, {
                                      correctionNote,
                                    });
                                  }}
                                  placeholder="Optional note"
                                  value={review.correctionNote ?? ""}
                                />
                              ) : (
                                <ReadOnlyText
                                  emptyLabel="No note"
                                  value={review.correctionNote}
                                />
                              )
                            ) : (
                              <PlaceholderText>No note</PlaceholderText>
                            )}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:hidden">
            {submission.extraction.fields.map((field) => {
              const review = measurementReviewMap.get(field.field) ?? {
                field: field.field,
                status: "pending" as const,
              };
              const isIncorrect = review.status === "corrected";
              const fieldIdFragment = toIdFragment(field.field);

              return (
                <div
                  key={field.field}
                  className="rounded-control border border-border bg-surface-muted p-4"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="break-words text-sm font-semibold text-text">
                        {field.field}
                      </p>
                      <MeasurementStatusSummary
                        confidence={field.confidence}
                        status={field.status}
                      />
                      <p className="break-words text-sm font-medium text-text">
                        {field.value}
                      </p>
                      <p className="text-xs leading-5 text-text-muted">
                        {formatEvidencePages(field.evidencePages)}
                      </p>
                    </div>

                    {showReviewFields ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                            Decision
                          </p>
                          {isEditing ? (
                            <DecisionPillGroup
                              onChange={(nextStatus) =>
                                updateMeasurementStatus(field.field, nextStatus)
                              }
                              status={review.status}
                            />
                          ) : (
                            <DecisionStatusBadge status={review.status} />
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                            Corrected output
                          </p>
                          {isIncorrect ? (
                            isEditing ? (
                              <TextField
                                aria-label={`Corrected value for ${field.field}`}
                                id={`measurement-mobile-value-${fieldIdFragment}`}
                                onChange={(event) => {
                                  const correctedValue = event.currentTarget.value;

                                  updateMeasurementCorrection(field.field, {
                                    correctedValue,
                                  });
                                }}
                                placeholder="Enter corrected value"
                                value={review.correctedValue ?? ""}
                              />
                            ) : (
                              <ReadOnlyText
                                className="font-medium"
                                emptyLabel="No correction"
                                value={review.correctedValue}
                              />
                            )
                          ) : (
                            <PlaceholderText>No correction</PlaceholderText>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                            Note
                          </p>
                          {isIncorrect ? (
                            isEditing ? (
                              <TextField
                                aria-label={`Correction note for ${field.field}`}
                                id={`measurement-mobile-note-${fieldIdFragment}`}
                                onChange={(event) => {
                                  const correctionNote = event.currentTarget.value;

                                  updateMeasurementCorrection(field.field, {
                                    correctionNote,
                                  });
                                }}
                                placeholder="Optional note"
                                value={review.correctionNote ?? ""}
                              />
                            ) : (
                              <ReadOnlyText
                                emptyLabel="No note"
                                value={review.correctionNote}
                              />
                            )
                          ) : (
                            <PlaceholderText>No note</PlaceholderText>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                Pins
              </p>
              <h3 className="text-2xl">{pinsTitle}</h3>
            </div>
            <span className="rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
              {submission.extraction.pinRows.length} pin rows
            </span>
          </div>

          {submission.extraction.pinRows.length > 0 ? (
            <>
              <div className="hidden overflow-hidden rounded-control border border-border bg-surface lg:block">
                <table className="min-w-full table-fixed border-collapse">
                  <colgroup>
                    {(showReviewFields
                      ? pinDesktopColumnWidths
                      : pinSummaryColumnWidths
                    ).map((width, index) => (
                      <col key={`pin-column-${index}`} style={{ width }} />
                    ))}
                  </colgroup>
                  <thead className="bg-surface-muted">
                    <tr>
                      <TableHeaderCell>AI pin</TableHeaderCell>
                      {showReviewFields ? (
                        <>
                          <TableHeaderCell>Decision</TableHeaderCell>
                          <TableHeaderCell>Corrected pin</TableHeaderCell>
                          <TableHeaderCell>Note</TableHeaderCell>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {submission.extraction.pinRows.map((pinRow, pinIndex) => {
                      const review = pinReviewMap.get(pinIndex) ?? {
                        pinIndex,
                        status: "pending" as const,
                      };
                      const isIncorrect = review.status === "corrected";
                      const correctedPinValue =
                        review.correctedPinNumber && review.correctedPinName
                          ? `Pin ${review.correctedPinNumber}: ${review.correctedPinName}`
                          : undefined;

                      return (
                        <tr
                          key={`${pinIndex}-${pinRow.pinNumber}-${pinRow.pinName}`}
                          className="border-t border-border"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="min-w-0 space-y-2">
                              <p className="break-words text-sm font-semibold text-text">
                                Pin {pinRow.pinNumber}: {pinRow.pinName}
                              </p>
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span
                                  className={[
                                    "text-xs font-medium",
                                    textToneClassNames[
                                      getConfidenceTone(pinRow.confidence)
                                    ],
                                  ].join(" ")}
                                >
                                  {formatConfidence(pinRow.confidence)}
                                </span>
                                <span className="text-xs leading-5 text-text-muted">
                                  {formatEvidencePages(pinRow.evidencePages)}
                                </span>
                              </div>
                            </div>
                          </td>
                          {showReviewFields ? (
                            <>
                              <td className="px-4 py-4 align-top">
                                {isEditing ? (
                                  <DecisionPillGroup
                                    onChange={(nextStatus) =>
                                      updatePinStatus(pinIndex, nextStatus)
                                    }
                                    status={review.status}
                                  />
                                ) : (
                                  <DecisionStatusBadge status={review.status} />
                                )}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {isIncorrect ? (
                                  isEditing ? (
                                    <div className="grid min-w-0 gap-2 xl:grid-cols-2">
                                      <TextField
                                        aria-label={`Corrected pin number for row ${pinIndex + 1}`}
                                        className="min-w-0"
                                        id={`pin-number-${pinIndex}`}
                                        onChange={(event) => {
                                          const correctedPinNumber =
                                            event.currentTarget.value;

                                          updatePinCorrection(pinIndex, {
                                            correctedPinNumber,
                                          });
                                        }}
                                        placeholder="Pin number"
                                        value={review.correctedPinNumber ?? ""}
                                      />
                                      <TextField
                                        aria-label={`Corrected pin name for row ${pinIndex + 1}`}
                                        className="min-w-0"
                                        id={`pin-name-${pinIndex}`}
                                        onChange={(event) => {
                                          const correctedPinName =
                                            event.currentTarget.value;

                                          updatePinCorrection(pinIndex, {
                                            correctedPinName,
                                          });
                                        }}
                                        placeholder="Pin name"
                                        value={review.correctedPinName ?? ""}
                                      />
                                    </div>
                                  ) : (
                                    <ReadOnlyText
                                      className="font-medium"
                                      emptyLabel="No correction"
                                      value={correctedPinValue}
                                    />
                                  )
                                ) : (
                                  <PlaceholderText>No correction</PlaceholderText>
                                )}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {isIncorrect ? (
                                  isEditing ? (
                                    <TextField
                                      aria-label={`Correction note for pin row ${pinIndex + 1}`}
                                      className="min-w-0"
                                      id={`pin-note-${pinIndex}`}
                                      onChange={(event) => {
                                        const correctionNote =
                                          event.currentTarget.value;

                                        updatePinCorrection(pinIndex, {
                                          correctionNote,
                                        });
                                      }}
                                      placeholder="Optional note"
                                      value={review.correctionNote ?? ""}
                                    />
                                  ) : (
                                    <ReadOnlyText
                                      emptyLabel="No note"
                                      value={review.correctionNote}
                                    />
                                  )
                                ) : (
                                  <PlaceholderText>No note</PlaceholderText>
                                )}
                              </td>
                            </>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:hidden">
                {submission.extraction.pinRows.map((pinRow, pinIndex) => {
                  const review = pinReviewMap.get(pinIndex) ?? {
                    pinIndex,
                    status: "pending" as const,
                  };
                  const isIncorrect = review.status === "corrected";
                  const correctedPinValue =
                    review.correctedPinNumber && review.correctedPinName
                      ? `Pin ${review.correctedPinNumber}: ${review.correctedPinName}`
                      : undefined;

                  return (
                    <div
                      key={`${pinIndex}-${pinRow.pinNumber}-${pinRow.pinName}`}
                      className="rounded-control border border-border bg-surface-muted p-4"
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-text">
                            Pin {pinRow.pinNumber}: {pinRow.pinName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "text-xs font-medium",
                                textToneClassNames[
                                  getConfidenceTone(pinRow.confidence)
                                ],
                              ].join(" ")}
                            >
                              {formatConfidence(pinRow.confidence)}
                            </span>
                            <span className="text-xs leading-5 text-text-muted">
                              {formatEvidencePages(pinRow.evidencePages)}
                            </span>
                          </div>
                        </div>

                        {showReviewFields ? (
                          <>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                Decision
                              </p>
                              {isEditing ? (
                                <DecisionPillGroup
                                  onChange={(nextStatus) =>
                                    updatePinStatus(pinIndex, nextStatus)
                                  }
                                  status={review.status}
                                />
                              ) : (
                                <DecisionStatusBadge status={review.status} />
                              )}
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                Corrected pin
                              </p>
                              {isIncorrect ? (
                                isEditing ? (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <TextField
                                      aria-label={`Corrected pin number for row ${pinIndex + 1}`}
                                      id={`pin-mobile-number-${pinIndex}`}
                                      onChange={(event) => {
                                        const correctedPinNumber =
                                          event.currentTarget.value;

                                        updatePinCorrection(pinIndex, {
                                          correctedPinNumber,
                                        });
                                      }}
                                      placeholder="Pin number"
                                      value={review.correctedPinNumber ?? ""}
                                    />
                                    <TextField
                                      aria-label={`Corrected pin name for row ${pinIndex + 1}`}
                                      id={`pin-mobile-name-${pinIndex}`}
                                      onChange={(event) => {
                                        const correctedPinName =
                                          event.currentTarget.value;

                                        updatePinCorrection(pinIndex, {
                                          correctedPinName,
                                        });
                                      }}
                                      placeholder="Pin name"
                                      value={review.correctedPinName ?? ""}
                                    />
                                  </div>
                                ) : (
                                  <ReadOnlyText
                                    className="font-medium"
                                    emptyLabel="No correction"
                                    value={correctedPinValue}
                                  />
                                )
                              ) : (
                                <PlaceholderText>No correction</PlaceholderText>
                              )}
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                Note
                              </p>
                              {isIncorrect ? (
                                isEditing ? (
                                  <TextField
                                    aria-label={`Correction note for pin row ${pinIndex + 1}`}
                                    id={`pin-mobile-note-${pinIndex}`}
                                    onChange={(event) => {
                                      const correctionNote =
                                        event.currentTarget.value;

                                      updatePinCorrection(pinIndex, {
                                        correctionNote,
                                      });
                                    }}
                                    placeholder="Optional note"
                                    value={review.correctionNote ?? ""}
                                  />
                                ) : (
                                  <ReadOnlyText
                                    emptyLabel="No note"
                                    value={review.correctionNote}
                                  />
                                )
                              ) : (
                                <PlaceholderText>No note</PlaceholderText>
                              )}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-control border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-sm leading-6 text-text-muted">
              No pin rows were extracted from this submission.
            </div>
          )}
        </Card>
      </div>

      {isEditing ? (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:left-[240px]">
          <div className="mx-auto w-full max-w-6xl px-6 pb-4 pt-2 sm:px-8">
            <div className="rounded-panel border border-border-strong bg-surface-elevated shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
                <div
                  aria-live="polite"
                  className="min-w-0 space-y-3"
                  role="status"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-pill border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]",
                        badgeToneClassNames[isDirty ? "warning" : "success"],
                      )}
                    >
                      {isDirty ? "Unsaved changes" : "No unsaved changes"}
                    </span>
                    <span className="rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                      {pendingDecisionLabel}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        textToneClassNames[actionStateTone],
                      )}
                    >
                      {actionStateTitle}
                    </p>
                    <p
                      className={cn(
                        "text-sm leading-6",
                        textToneClassNames[actionStateTone],
                      )}
                    >
                      {actionStateMessage}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={isSaving}
                    onClick={handleCancel}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!isDirty || isSaving || Boolean(draftError)}
                    onClick={handleSave}
                  >
                    {isSaving ? "Saving review..." : "Save review"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
