"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useBackgroundTasks } from "@/components/background-tasks-provider";
import { useNavigationGuardControls } from "@/components/navigation-blocker-provider";
import { Button, Callout, Dialog, useToast } from "@/components/ui";
import { getOpenAIModelDefinition } from "@/lib/ai/models";
import { formatModelShortLabel } from "@/lib/ai/provider-meta";

/** What is being deleted (spec §5.10). */
export type DeleteSubmissionTarget =
  | {
      kind: "baseline";
      partNumber: string;
      /** Re-runs compared against this baseline. With > 0 the delete cascades. */
      runCount: number;
      submissionId: string;
    }
  | {
      /** Null for an orphan run whose baseline is already gone. */
      baselineSubmissionId: string | null;
      kind: "rerun";
      /** The run's model id, e.g. "gpt-5.6-sol". */
      model: string;
      submissionId: string;
    };

export type DeleteSubmissionResult = {
  deletedIds: string[];
  target: DeleteSubmissionTarget;
};

export type DeleteSubmissionDialogProps = {
  onClose: () => void;
  /** Runs after a successful delete, before any navigation. */
  onDeleted?: (result: DeleteSubmissionResult) => void;
  open: boolean;
  /**
   * Where to go afterwards (history is replaced). Leave undefined for the spec
   * default: "/submissions" after a baseline, the baseline's review page after
   * a re-run. Pass null to stay on the page and refresh it (list pages).
   */
  redirectHref?: string | null;
  target: DeleteSubmissionTarget | null;
};

type DeleteCopy = {
  confirmLabel: string;
  description: string;
  successToast: string;
  title: string;
};

export const RUN_IN_PROGRESS_REASON = "A model run is still in progress";

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeDeleteTarget(target: DeleteSubmissionTarget): DeleteCopy {
  if (target.kind === "rerun") {
    const modelLabel =
      getOpenAIModelDefinition(target.model)?.label ?? target.model;

    return {
      confirmLabel: "Delete run",
      description: "The baseline and its review aren't affected.",
      successToast: `Deleted the ${formatModelShortLabel(target.model)} run`,
      title: `Delete this ${modelLabel} run?`,
    };
  }

  if (target.runCount > 0) {
    const runs = pluralize(target.runCount, "run", "runs");
    const modelRuns = pluralize(target.runCount, "model run", "model runs");

    return {
      confirmLabel: `Delete ${target.runCount + 1} submissions`,
      description: `This permanently deletes the baseline, its review, the ${modelRuns} compared against it, and any uploaded PDFs. This can't be undone.`,
      successToast: `Deleted ${target.partNumber}`,
      title: `Delete ${target.partNumber} and its ${runs}?`,
    };
  }

  return {
    confirmLabel: "Delete",
    description:
      "This permanently deletes the extraction, its review and the uploaded PDF, if any. This can't be undone.",
    successToast: `Deleted ${target.partNumber}`,
    title: `Delete ${target.partNumber}?`,
  };
}

function getGroupId(target: DeleteSubmissionTarget) {
  return target.kind === "baseline"
    ? target.submissionId
    : (target.baselineSubmissionId ?? target.submissionId);
}

function getDefaultRedirect(target: DeleteSubmissionTarget) {
  if (target.kind === "rerun" && target.baselineSubmissionId) {
    return `/submissions/${encodeURIComponent(target.baselineSubmissionId)}`;
  }

  return "/submissions";
}

async function requestDelete(target: DeleteSubmissionTarget) {
  const cascade = target.kind === "baseline" && target.runCount > 0;
  const url = `/api/submissions/${encodeURIComponent(target.submissionId)}${cascade ? "?cascade=runs" : ""}`;
  const response = await fetch(url, { method: "DELETE" });
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (!response.ok || record.success === false) {
    throw new Error(
      typeof record.error === "string" && record.error
        ? record.error
        : "The server couldn't delete this submission.",
    );
  }

  const deletedIds = Array.isArray(record.deletedIds)
    ? record.deletedIds.filter((id): id is string => typeof id === "string")
    : [target.submissionId];

  return deletedIds;
}

/**
 * Shared delete confirmation for the review header and list rows. An
 * alertdialog with focus on Cancel. A baseline with runs always cascades
 * (`DELETE …?cascade=runs`) and says so.
 */
export function DeleteSubmissionDialog({
  onClose,
  onDeleted,
  open,
  redirectHref,
  target,
}: DeleteSubmissionDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const { navigate } = useNavigationGuardControls();
  const { isGroupBusy } = useBackgroundTasks();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = target ? describeDeleteTarget(target) : null;
  const isBusy = target ? isGroupBusy(getGroupId(target)) : false;

  function handleClose() {
    if (isDeleting) {
      return;
    }

    setError(null);
    onClose();
  }

  async function handleDelete() {
    if (!target || !copy || isDeleting || isBusy) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    let deletedIds: string[];

    try {
      deletedIds = await requestDelete(target);
    } catch (deleteError) {
      setIsDeleting(false);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The server couldn't delete this submission.",
      );
      return;
    }

    setIsDeleting(false);
    onClose();
    onDeleted?.({ deletedIds, target });
    toast.show({ title: copy.successToast });

    const href =
      redirectHref === undefined ? getDefaultRedirect(target) : redirectHref;

    if (href === null) {
      router.refresh();
    } else {
      navigate(href, { replace: true });
    }
  }

  return (
    <Dialog
      description={copy?.description}
      footer={
        <>
          <Button
            disabled={isDeleting}
            onClick={handleClose}
            ref={cancelButtonRef}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            aria-describedby={isBusy ? reasonId : undefined}
            disabled={isBusy}
            loading={isDeleting}
            onClick={handleDelete}
            variant="danger"
          >
            {isDeleting ? "Deleting…" : copy?.confirmLabel}
          </Button>
        </>
      }
      initialFocusRef={cancelButtonRef}
      onClose={handleClose}
      open={open && target !== null}
      role="alertdialog"
      size="sm"
      title={copy?.title ?? ""}
    >
      {isBusy || error ? (
        <div className="space-y-3">
          {isBusy ? (
            <p className="text-callout text-text-muted" id={reasonId}>
              {RUN_IN_PROGRESS_REASON}. You can delete once it finishes.
            </p>
          ) : null}
          {error ? (
            <Callout title="Couldn't delete" tone="danger">
              {error}
            </Callout>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
