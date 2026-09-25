"use client";

import { useState, type ReactNode } from "react";

import {
  DescriptionList,
  Popover,
  type DescriptionListItem,
  type PopoverProps,
} from "@/components/ui";
import { formatLatency, formatTokenCount, formatUsd } from "@/lib/ai/provider-meta";
import { formatBytes, formatDateTime } from "@/lib/format";
import { describeSubmissionSource } from "@/lib/submissions/source";
import type { SubmissionDetail } from "@/lib/submissions/types";

import { formatModelDotEffort, pluralize } from "./workspace-model";

export type SubmissionDetailsProps = {
  /** Review page of the baseline, for re-runs. */
  baselineHref: string | null;
  /** Addendum F note when the datasheet shown is a later vendor copy, else null. */
  revisionNote: ReactNode;
  submission: SubmissionDetail;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The Details list (§4.3 header item 3): identity, source, run metadata and
 * dates, plus the note that the AI output is immutable. Rendered only while
 * open (client-side), so local dates never cause a hydration mismatch.
 */
export function SubmissionDetails({ baselineHref, revisionNote, submission }: SubmissionDetailsProps) {
  const { intake, providerMeta } = submission;
  const source = describeSubmissionSource(intake.sourceMeta);
  const usage = providerMeta.usage;
  const items: DescriptionListItem[] = [
    { copyValue: intake.partNumber, term: "Part number", value: <span className="font-mono">{intake.partNumber}</span> },
    { term: "Category", value: intake.packageCategory },
  ];

  if (source.kind === "url" && source.originalUrl) {
    items.push({
      href: source.originalUrl,
      term: "Source",
      value: <span className="break-all">{source.originalUrl}</span>,
    });
  } else {
    const checksum =
      intake.sourceMeta.kind === "upload" ? intake.sourceMeta.checksumSha256.slice(0, 8) : null;

    items.push({
      term: "Source",
      value: [
        source.fileName,
        source.sizeBytes !== null ? formatBytes(source.sizeBytes) : null,
        checksum ? `sha256 ${checksum}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (submission.comparison) {
    items.push({
      href: baselineHref ?? undefined,
      term: "Re-run of",
      value: submission.comparison.baseline
        ? `${submission.comparison.baseline.partNumber} baseline`
        : "A deleted baseline",
    });
  }

  items.push({ term: "Requested fields", value: pluralize(intake.requestedFields.length, "field") });
  items.push({ term: "Model", value: formatModelDotEffort(providerMeta) });

  if (usage && isFiniteNumber(usage.inputTokens) && isFiniteNumber(usage.outputTokens)) {
    items.push({
      term: "Tokens",
      value: [
        `${formatTokenCount(usage.inputTokens)} in`,
        `${formatTokenCount(usage.outputTokens)} out`,
        isFiniteNumber(usage.reasoningTokens) && usage.reasoningTokens > 0
          ? `${formatTokenCount(usage.reasoningTokens)} reasoning`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (isFiniteNumber(providerMeta.latencyMs)) {
    items.push({ term: "Latency", value: formatLatency(providerMeta.latencyMs) });
  }

  if (isFiniteNumber(providerMeta.estimatedCostUsd)) {
    items.push({ term: "Est. cost", value: formatUsd(providerMeta.estimatedCostUsd) });
  }

  if (providerMeta.responseId) {
    items.push({
      copyValue: providerMeta.responseId,
      term: "Response id",
      value: <span className="block truncate font-mono text-callout">{providerMeta.responseId}</span>,
    });
  }

  items.push({ term: "Created", value: formatDateTime(submission.createdAt) });
  items.push({ term: "Updated", value: formatDateTime(submission.updatedAt) });
  items.push({
    term: "Reviewed",
    value: submission.reviewedAt ? formatDateTime(submission.reviewedAt) : "Not yet",
  });

  return (
    <div className="space-y-4">
      <DescriptionList className="sm:grid-cols-[minmax(6.5rem,max-content)_minmax(0,1fr)]" items={items} />
      {revisionNote ? (
        <p className="rounded-sm bg-surface-muted px-3 py-2 text-caption text-text-muted">
          {revisionNote}
        </p>
      ) : null}
      <p className="border-t border-border-subtle pt-3 text-caption text-text-muted">
        The AI output is stored exactly as extracted. Your decisions are saved as a separate
        review layer.
      </p>
    </div>
  );
}

export type DetailsPopoverProps = SubmissionDetailsProps & {
  /** The meta text button (xl) or the Info icon button (below xl). */
  trigger: PopoverProps["trigger"];
};

/** 360 px Details popover opened from the header meta line. */
export function DetailsPopover({ trigger, ...props }: DetailsPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover align="start" label="Submission details" onOpenChange={setOpen} trigger={trigger} width={360}>
      {open ? <SubmissionDetails {...props} /> : null}
    </Popover>
  );
}
