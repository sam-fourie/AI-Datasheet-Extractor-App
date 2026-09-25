"use client";

import { useRef, useState } from "react";

import { useBackgroundTasks } from "@/components/background-tasks-provider";
import { useNavigationGuardControls } from "@/components/navigation-blocker-provider";
import { Button, Callout, LinkButton, Tooltip, useToast } from "@/components/ui";
import type { OpenAIModelId, OpenAIReasoningEffort } from "@/lib/ai/models";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import type { RerunRequestPayload } from "@/lib/extractions";
import { formatRelativeTime } from "@/lib/format";
import { isScoredAgreement } from "@/lib/submissions/agreement";
import type { DatasheetIndexEntry, SubmissionDetail } from "@/lib/submissions/types";

import { pluralize } from "./intake-helpers";

export type DuplicateNoticeProps = {
  entry: DatasheetIndexEntry;
  /** "url" when only the datasheet link matched (the typed part number differs). */
  matchedBy: "partNumber" | "url";
  model: OpenAIModelId;
  onDismiss: () => void;
  reasoningEffort: OpenAIReasoningEffort;
};

function describeEntry(entry: DatasheetIndexEntry, matchedBy: "partNumber" | "url") {
  const progress = entry.reviewProgress;
  const date = formatRelativeTime(entry.createdAt);
  const runs = entry.runCount > 0 ? ` · ${pluralize(entry.runCount, "run")}` : "";

  if (matchedBy === "url") {
    const status =
      progress.state === "reviewed"
        ? `reviewed baseline, ${date}${runs}`
        : progress.state === "inProgress"
          ? `baseline in review, ${progress.decided} of ${progress.total} decided`
          : `baseline waiting for review, ${date}${runs}`;

    return `This link was already extracted as ${entry.partNumber} (${status}).`;
  }

  if (progress.state === "reviewed") {
    return `${entry.partNumber} already has a reviewed baseline (${date}${runs}).`;
  }

  if (progress.state === "inProgress") {
    return `${entry.partNumber} already has a baseline in review (${progress.decided} of ${progress.total} decided).`;
  }

  return `${entry.partNumber} already has a baseline waiting for review (${date}${runs}).`;
}

async function postRerun(
  baselineId: string,
  payload: RerunRequestPayload,
  signal: AbortSignal,
): Promise<SubmissionDetail> {
  const response = await fetch(`/api/submissions/${baselineId}/rerun`, {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | SubmissionDetail
    | { error?: string }
    | null;

  if (!response.ok || !body || !("submissionId" in body)) {
    throw new Error(
      (body && "error" in body && body.error) || "The comparison run didn't finish.",
    );
  }

  return body;
}

/**
 * Neutral callout under the part number when a baseline already exists for
 * the same part number (normalised) or the same link (spec §4.1, addendum E).
 */
export function DuplicateNotice({
  entry,
  matchedBy,
  model,
  onDismiss,
  reasoningEffort,
}: DuplicateNoticeProps) {
  const { startTask } = useBackgroundTasks();
  const { navigate } = useNavigationGuardControls();
  const toast = useToast();
  const baselineHref = `/submissions/${entry.submissionId}`;
  const runLabel = formatRunLabel({ model, reasoningEffort });
  // One-shot guard: the page stays clickable until the review route loads, and
  // each extra click would start another paid re-run. The ref blocks a double
  // click before the re-render; the state shows the button as busy.
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);

  function runAsComparison() {
    if (!entry.pdfRetained || startedRef.current) {
      return;
    }

    const taskId = startTask<SubmissionDetail>({
      groupId: entry.submissionId,
      kind: "rerun",
      label: runLabel,
      onSuccess: (result) => {
        const agreement = result.comparison?.agreement ?? null;
        const href = `/submissions/${result.submissionId}`;

        return {
          href,
          toast: {
            action: { href, label: "Open run" },
            description: `Comparison run for ${entry.partNumber}`,
            durationMs: 8000,
            title: isScoredAgreement(agreement)
              ? `${runLabel} finished · ${Math.round(agreement.agreementPercentage)}% agreement`
              : `${runLabel} finished`,
            tone: "success",
          },
        };
      },
      run: (signal) => postRerun(entry.submissionId, { model, reasoningEffort }, signal),
    });

    if (taskId === null) {
      toast.show({
        description: "Wait for one to finish, then try again.",
        title: "3 model runs are already in progress",
        tone: "warning",
      });
      return;
    }

    startedRef.current = true;
    setStarted(true);
    toast.show({
      description: `${runLabel} on ${entry.partNumber}. We'll let you know when it finishes.`,
      title: "Comparison run started",
    });
    navigate(baselineHref);
  }

  const runButton = (
    <Button
      aria-disabled={entry.pdfRetained ? undefined : true}
      className={
        entry.pdfRetained
          ? undefined
          : "text-text-tertiary hover:bg-surface aria-disabled:text-text-tertiary"
      }
      loading={started}
      onClick={runAsComparison}
      size="sm"
      variant="secondary"
    >
      Run as comparison
    </Button>
  );

  return (
    <Callout
      actions={
        <>
          <LinkButton href={baselineHref} size="sm" variant="secondary">
            Open review
          </LinkButton>
          <Tooltip
            content={
              entry.pdfRetained
                ? "Uses the PDF saved with that submission and your model settings below."
                : "The PDF for that submission wasn't kept"
            }
          >
            {runButton}
          </Tooltip>
          <Button onClick={onDismiss} size="sm" variant="plain">
            Create a new baseline anyway
          </Button>
        </>
      }
      role="status"
      tone="neutral"
    >
      {describeEntry(entry, matchedBy)}
    </Callout>
  );
}
