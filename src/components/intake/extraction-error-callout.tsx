"use client";

import { useEffect } from "react";

import { Button, Callout, Disclosure } from "@/components/ui";

import type { ExtractionFailure } from "./intake-helpers";

export type ExtractionErrorAction =
  | "try-again"
  | "upload-instead"
  | "choose-file"
  | "retry-medium";

export type ExtractionErrorCalloutProps = {
  failure: ExtractionFailure;
  onAction: (action: ExtractionErrorAction) => void;
  onDismiss: () => void;
  /** Hide "Retry at Medium effort" when the run already used Medium or lower. */
  canRetryAtMedium: boolean;
};

type ErrorCopy = {
  actions: Array<{ action: ExtractionErrorAction; label: string }>;
  body: string;
  showDetails: boolean;
  title: string;
};

const TRY_AGAIN = { action: "try-again", label: "Try again" } as const;
const CHOOSE_FILE = { action: "choose-file", label: "Choose another file" } as const;

/** Copy and actions per error code (spec §2.2). */
export function describeExtractionFailure(failure: ExtractionFailure): ErrorCopy {
  switch (failure.code) {
    case "upload-failed":
      return {
        actions: [TRY_AGAIN],
        body: "Check your connection and try again.",
        showDetails: false,
        title: "Upload didn't finish",
      };
    case "source-unreachable":
      return {
        actions: [{ action: "upload-instead", label: "Upload a file instead" }, TRY_AGAIN],
        body: "The site blocked the download or the link has moved. Download the PDF and drop it here instead.",
        showDetails: false,
        title: "We couldn't download that PDF",
      };
    case "invalid-pdf":
      return {
        actions: [CHOOSE_FILE],
        body: "Check that it opens in a PDF viewer, then try again.",
        showDetails: false,
        title: "That file isn't a readable PDF",
      };
    case "too-large":
      return {
        actions: [CHOOSE_FILE],
        body: "Compress it or upload a smaller copy.",
        showDetails: false,
        title: "That PDF is over 50 MB",
      };
    case "timeout":
      return {
        actions: [{ action: "retry-medium", label: "Retry at Medium effort" }, TRY_AGAIN],
        body: "Dense datasheets sometimes need longer than 4 minutes at this effort.",
        showDetails: false,
        title: "The model ran out of time",
      };
    case "not-configured":
      return {
        actions: [],
        body: "Ask an admin to check the server configuration.",
        showDetails: true,
        title: "Extraction isn't set up on this server",
      };
    default:
      return {
        actions: [TRY_AGAIN],
        body: "The extraction didn't finish. Your inputs are still here, so you can try again.",
        showDetails: true,
        title: "Something went wrong",
      };
  }
}

/**
 * Danger callout above the restored form. It takes focus when it appears so
 * keyboard and screen reader users land on it (role="alert" also announces it).
 */
export function ExtractionErrorCallout({
  canRetryAtMedium,
  failure,
  onAction,
  onDismiss,
}: ExtractionErrorCalloutProps) {
  const copy = describeExtractionFailure(failure);
  const actions = copy.actions.filter(
    (entry) => entry.action !== "retry-medium" || canRetryAtMedium,
  );

  useEffect(() => {
    const element = document.getElementById("extraction-error");

    element?.focus();
    element?.scrollIntoView({ block: "nearest" });
  }, [failure]);

  return (
    <Callout
      actions={
        actions.length > 0
          ? actions.map((entry, index) => (
              <Button
                key={entry.action}
                onClick={() => onAction(entry.action)}
                size="sm"
                variant={index === 0 ? "secondary" : "plain"}
              >
                {entry.label}
              </Button>
            ))
          : undefined
      }
      dismissible
      id="extraction-error"
      onDismiss={onDismiss}
      tabIndex={-1}
      title={copy.title}
      tone="danger"
    >
      <p>{copy.body}</p>
      {copy.showDetails && failure.message ? (
        <Disclosure
          className="mt-2"
          contentClassName="pl-5 font-mono text-caption break-words text-text-on-tint"
          summary={<span className="text-callout">Details</span>}
        >
          {failure.message}
        </Disclosure>
      ) : null}
    </Callout>
  );
}
