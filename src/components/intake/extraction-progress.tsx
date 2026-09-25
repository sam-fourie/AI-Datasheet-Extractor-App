"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleDashed } from "lucide-react";

import { Button, cn, ProgressBar, Spinner } from "@/components/ui";
import { formatBytes, formatElapsed } from "@/lib/format";

import {
  estimateSeconds,
  getSlowThresholdMs,
  type ModelRunEstimate,
} from "./intake-helpers";
import type { ExtractionRequestState } from "./use-extraction-request";

export type ExtractionProgressProps = {
  estimate: ModelRunEstimate | null;
  /** "Small Outline Packages · se555.pdf · GPT-5.6 Terra · High" */
  meta: string;
  onCancel: () => void;
  partNumber: string;
  state: ExtractionRequestState;
};

type StepStatus = "done" | "active" | "upcoming";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <CircleCheck aria-hidden="true" className="size-4 text-success" />;
  }

  if (status === "active") {
    return <Spinner className="text-accent" />;
  }

  return <CircleDashed aria-hidden="true" className="size-4 text-pending" />;
}

function Step({
  children,
  label,
  status,
}: {
  children?: ReactNode;
  label: ReactNode;
  status: StepStatus;
}) {
  return (
    <li className="flex min-w-0 gap-3">
      <span className="flex h-5 shrink-0 items-center">
        <StepIcon status={status} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p
          className={cn(
            "text-body",
            status === "upcoming" ? "text-text-muted" : "text-text",
            status === "active" && "font-medium",
          )}
        >
          {label}
          <span className="sr-only">
            {status === "done" ? " (done)" : status === "upcoming" ? " (up next)" : ""}
          </span>
        </p>
        {children}
      </div>
    </li>
  );
}

/** Indeterminate 2 px accent line under the active step; static under reduced motion. */
function ActivityLine() {
  return (
    <span aria-hidden="true" className="block h-0.5 w-full overflow-hidden rounded-pill bg-surface-muted">
      <span className="block h-full w-full rounded-pill bg-accent/70 motion-safe:animate-pulse" />
    </span>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}

/**
 * Wait state for an extraction (spec §2.2): upload bytes, a timer for the
 * model call with an honest "usually about N s", Cancel, and one polite
 * status region that announces stage changes only.
 */
export function ExtractionProgress({
  estimate,
  meta,
  onCancel,
  partNumber,
  state,
}: ExtractionProgressProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { phase, upload } = state;
  const hasUpload = state.input?.source.kind === "upload";
  const now = useNow(phase === "extracting");
  const elapsedMs =
    phase === "extracting" && state.extractStartedAt !== null
      ? Math.max(0, now - state.extractStartedAt)
      : 0;
  const slowThresholdMs = getSlowThresholdMs(estimate);
  const isSlow = phase === "extracting" && elapsedMs >= slowThresholdMs;
  const usualSeconds = estimateSeconds(estimate);
  const usualCopy =
    usualSeconds !== null ? `usually about ${usualSeconds} s` : "usually 10 to 50 s";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const uploadStatus: StepStatus = phase === "uploading" ? "active" : "done";
  const readStatus: StepStatus =
    phase === "uploading" ? "upcoming" : phase === "extracting" ? "active" : "done";
  const openStatus: StepStatus = phase === "opening" ? "active" : "upcoming";

  const announcement =
    phase === "uploading"
      ? "Uploading"
      : phase === "extracting"
        ? isSlow
          ? "Still working"
          : hasUpload
            ? "Upload complete, extracting"
            : "Extracting"
        : phase === "opening"
          ? "Opening review"
          : "";

  const uploadTotal = upload?.total ?? 0;
  const uploadLoaded = Math.min(upload?.loaded ?? 0, uploadTotal);
  const extractedSeconds =
    state.extractDurationMs !== null ? Math.max(1, Math.round(state.extractDurationMs / 1000)) : null;

  return (
    <section aria-labelledby="extraction-progress-title" className="animate-fade-in space-y-6">
      <header className="min-w-0 space-y-1">
        <h2
          className="text-title-3 break-words text-text outline-none"
          id="extraction-progress-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Extracting <span className="font-mono">{partNumber}</span>
        </h2>
        <p className="text-callout break-words text-text-muted">{meta}</p>
      </header>

      <ol className="space-y-4">
        {hasUpload ? (
          <Step
            label={
              uploadStatus === "active"
                ? `Uploading PDF · ${formatBytes(uploadLoaded)} of ${formatBytes(uploadTotal)}`
                : state.uploadReused
                  ? `Already uploaded ${formatBytes(uploadTotal)}`
                  : `Uploaded ${formatBytes(uploadTotal)}`
            }
            status={uploadStatus}
          >
            {uploadStatus === "active" ? (
              <ProgressBar
                label="Upload progress"
                segments={[{ tone: "accent", value: uploadLoaded }]}
                total={Math.max(uploadTotal, 1)}
                valueText={`${formatBytes(uploadLoaded)} of ${formatBytes(uploadTotal)}`}
                variant="sm"
              />
            ) : null}
          </Step>
        ) : null}

        <Step
          label={
            readStatus === "active" ? (
              isSlow ? (
                <>
                  Taking longer than usual. Dense datasheets can take up to 4 minutes.{" "}
                  <span className="font-normal text-text-muted tabular-nums">
                    {formatElapsed(elapsedMs)}
                  </span>
                </>
              ) : (
                <>
                  Reading the datasheet{" "}
                  <span className="font-normal text-text-muted tabular-nums">
                    · {formatElapsed(elapsedMs)} · {usualCopy}
                  </span>
                </>
              )
            ) : readStatus === "done" ? (
              extractedSeconds !== null ? `Extracted in ${extractedSeconds} s` : "Extracted"
            ) : (
              "Read the datasheet"
            )
          }
          status={readStatus}
        >
          {readStatus === "active" ? <ActivityLine /> : null}
        </Step>

        <Step
          label={openStatus === "active" ? "Saving and opening review…" : "Open review"}
          status={openStatus}
        />
      </ol>

      <p className="sr-only" role="status">
        {announcement}
      </p>

      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <Button
          disabled={phase === "opening"}
          onClick={onCancel}
          variant="ghost"
          className="-ml-3"
        >
          Cancel
        </Button>
        <p className="text-caption text-text-muted">
          {phase === "opening"
            ? "The extraction is saved."
            : "Leaving this page cancels the extraction."}
        </p>
      </div>
    </section>
  );
}
