"use client";

import type { ReactNode } from "react";

import { ProgressBar } from "@/components/ui";

import { NextButton, type ToolbarProgress } from "./review-toolbar";

export type MobileReviewBarProps = {
  /** The primary slot: Save (dirty), Edit review / Review this run (read), Done. */
  action: ReactNode;
  onNext: () => void;
  progress: ToolbarProgress;
};

/**
 * Below 768 px (§4.3): a fixed bottom bar with a hairline progress bar on its
 * top edge, "27 / 109", Next and the primary action. The workspace pads the
 * page and offsets toasts so nothing hides under it.
 */
export function MobileReviewBar({ action, onNext, progress }: MobileReviewBarProps) {
  const decided = progress.total - progress.pending;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-material pb-[env(safe-area-inset-bottom)] backdrop-blur-[20px] backdrop-saturate-[1.8] md:hidden"
      data-review-mobile-bar=""
    >
      <ProgressBar
        className="absolute inset-x-0 -top-px rounded-none!"
        label="Review progress"
        segments={[
          { tone: "success", value: progress.confirmed },
          { tone: "danger", value: progress.corrected },
        ]}
        total={progress.total}
        valueText={`${decided} of ${progress.total} decided`}
        variant="hairline"
      />
      <div className="flex h-14 items-center gap-3 px-4">
        <p className="text-callout text-text-muted tabular-nums">
          <span className="font-medium text-text">{decided}</span> / {progress.total}
          <span className="sr-only"> decided</span>
        </p>
        <NextButton onNext={onNext} pending={progress.pending} />
        <div className="ml-auto flex min-w-0 items-center gap-2">{action}</div>
      </div>
    </div>
  );
}
