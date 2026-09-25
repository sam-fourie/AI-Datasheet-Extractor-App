"use client";

import { useSyncExternalStore, type Ref } from "react";
import { Check, ChevronDown, CircleAlert } from "lucide-react";

import { AppLink } from "@/components/app-link";
import type { BackgroundTask } from "@/components/background-tasks-provider";
import { RelativeTime } from "@/components/relative-time";
import { describeReviewStatus } from "@/components/review-status-badge";
import { ScoreBadge } from "@/components/score-badge";
import { Badge, Button, Dialog, Popover, Spinner, cn } from "@/components/ui";
import { formatLatency, formatRunLabel, formatUsd } from "@/lib/ai/provider-meta";
import { formatElapsed } from "@/lib/format";
import type { SubmissionModelRun } from "@/lib/submissions/types";

import { describeRunAgreement } from "./workspace-model";

/* ------------------------------ Elapsed clock ------------------------------ */

let tickNow = 0;
let tickTimer: number | null = null;
const tickListeners = new Set<() => void>();

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  tickNow = Date.now();

  if (tickTimer === null) {
    tickTimer = window.setInterval(() => {
      tickNow = Date.now();
      tickListeners.forEach((current) => current());
    }, 1000);
  }

  return () => {
    tickListeners.delete(listener);

    if (tickListeners.size === 0 && tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

function getTick() {
  if (tickNow === 0) {
    tickNow = Date.now();
  }

  return tickNow;
}

/** "0:21" since `startedAt`, ticking every second (client only). */
export function ElapsedTime({ className, startedAt }: { className?: string; startedAt: number }) {
  const now = useSyncExternalStore(subscribeTick, getTick, () => null);

  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {now === null ? "0:00" : formatElapsed(now - startedAt)}
    </span>
  );
}

/* ---------------------------------- List ----------------------------------- */

export type RunSwitcherListProps = {
  currentSubmissionId: string;
  /** The popover shows its own heading; the sheet uses the dialog title. */
  heading?: boolean;
  hrefFor: (submissionId: string) => string;
  onNavigate?: () => void;
  onRetryTask: (taskId: string) => void;
  onRunAnotherModel: () => void;
  reportsHref: string;
  runAnotherDisabledReason: string | null;
  runs: readonly SubmissionModelRun[];
  /** Background re-runs of this datasheet (running or failed). */
  tasks: readonly BackgroundTask[];
};

function RunSubline({ run }: { run: SubmissionModelRun }) {
  const { latencyMs, estimatedCostUsd } = run.providerMeta;
  const performance = [
    typeof latencyMs === "number" && Number.isFinite(latencyMs) ? formatLatency(latencyMs) : null,
    typeof estimatedCostUsd === "number" && Number.isFinite(estimatedCostUsd)
      ? formatUsd(estimatedCostUsd)
      : null,
  ].filter(Boolean);

  return (
    <>
      <RelativeTime iso={run.createdAt} />
      {performance.length > 0 ? ` · ${performance.join(" · ")}` : null}
    </>
  );
}

function baselineProgressText(run: SubmissionModelRun) {
  const { decided, state, total } = run.reviewProgress;

  if (state === "inProgress") {
    return `In review · ${decided} of ${total}`;
  }

  return describeReviewStatus(run.reviewProgress).text;
}

const rowClassName =
  "grid min-h-12 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-sm px-2.5 py-1.5 pointer-coarse:min-h-14";

/**
 * "Runs on this datasheet" (§5.8): the baseline, then the re-runs oldest
 * first, running and failed background runs, and the footer actions. Rows are
 * AppLinks, so the dirty-draft guard applies.
 */
export function RunSwitcherList({
  currentSubmissionId,
  heading = true,
  hrefFor,
  onNavigate,
  onRetryTask,
  onRunAnotherModel,
  reportsHref,
  runAnotherDisabledReason,
  runs,
  tasks,
}: RunSwitcherListProps) {
  const reruns = runs.filter((run) => !run.isBaseline);
  const baseline = runs.find((run) => run.isBaseline) ?? null;
  const visibleTasks = tasks.filter((task) => task.status !== "succeeded");
  const ordered = baseline ? [baseline, ...reruns] : reruns;

  return (
    <div className="space-y-3">
      {heading ? (
        <p className="px-1 text-callout font-semibold text-text">Runs on this datasheet</p>
      ) : null}
      <ul className="space-y-0.5">
        {ordered.map((run) => {
          const current = run.submissionId === currentSubmissionId;
          const label = formatRunLabel(run.providerMeta);
          const agreement = run.isBaseline ? null : describeRunAgreement(run.agreement);

          return (
            <li key={run.submissionId}>
              <AppLink
                aria-current={current ? "page" : undefined}
                className={cn(
                  rowClassName,
                  "text-text outline-offset-[-2px]",
                  current ? "bg-surface-selected" : "hover:bg-surface-hover",
                )}
                href={hrefFor(run.submissionId)}
                onClick={onNavigate}
              >
                <span aria-hidden="true" className="flex text-accent">
                  {current ? <Check className="size-4" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-body font-medium">{label}</span>
                    {run.isBaseline ? (
                      <Badge size="sm" tone="neutral">
                        Baseline
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block truncate text-caption text-text-muted tabular-nums">
                    {run.isBaseline ? baselineProgressText(run) : <RunSubline run={run} />}
                  </span>
                </span>
                <span className="flex flex-col items-end text-right">
                  {agreement?.scored ? (
                    <ScoreBadge kind="agreement" size="sm" value={agreement.value} />
                  ) : agreement ? (
                    <>
                      {agreement.value !== null ? (
                        <ScoreBadge kind="agreement" scored={false} size="sm" value={agreement.value} />
                      ) : null}
                      <span className="text-caption text-text-muted">
                        {agreement.text === "vs unreviewed baseline"
                          ? "vs unreviewed"
                          : agreement.text?.startsWith("vs partly")
                            ? "vs partly reviewed"
                            : agreement.text}
                      </span>
                    </>
                  ) : null}
                </span>
              </AppLink>
            </li>
          );
        })}
        {visibleTasks.map((task) => (
          <li className={cn(rowClassName, "text-text")} key={task.id}>
            <span aria-hidden="true" className="flex">
              {task.status === "failed" ? (
                <CircleAlert className="size-4 text-danger" />
              ) : (
                <Spinner className="text-accent" size={14} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body font-medium">{task.label}</span>
              <span className="block truncate text-caption text-text-muted">
                {task.status === "failed" ? (
                  <span className="text-danger">Run failed{task.error ? ` · ${task.error}` : ""}</span>
                ) : (
                  <>
                    Running · <ElapsedTime startedAt={task.startedAt} />
                  </>
                )}
              </span>
            </span>
            <span>
              {task.status === "failed" ? (
                <Button onClick={() => onRetryTask(task.id)} size="sm" variant="ghost">
                  Retry
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {reruns.length === 0 && visibleTasks.length === 0 ? (
        <p className="px-1 text-callout text-text-muted">
          No other runs yet. Run another model to measure agreement.
        </p>
      ) : null}
      <div className="space-y-2 border-t border-border-subtle pt-3">
        <Button
          className="w-full"
          disabled={Boolean(runAnotherDisabledReason)}
          onClick={onRunAnotherModel}
          variant="secondary"
        >
          Run another model…
        </Button>
        {runAnotherDisabledReason ? (
          <p className="px-1 text-caption text-text-muted">{runAnotherDisabledReason}</p>
        ) : null}
        <AppLink
          className="block px-1 py-1 text-callout font-medium text-accent-text hover:underline"
          href={reportsHref}
          onClick={onNavigate}
        >
          Compare models in Reports →
        </AppLink>
      </div>
    </div>
  );
}

/* --------------------------------- Switcher -------------------------------- */

export type RunSwitcherProps = Omit<RunSwitcherListProps, "onNavigate"> & {
  /** Full trigger text, e.g. "GPT-5.4 · Baseline · 4 runs". */
  label: string;
  /** Shorter trigger text below xl, e.g. "Baseline · 4 runs". */
  compactLabel: string;
  triggerRef?: Ref<HTMLButtonElement>;
};

/** Header run switcher: a secondary button opening a 400 px popover. */
export function RunSwitcher({ compactLabel, label, triggerRef, ...listProps }: RunSwitcherProps) {
  return (
    <Popover
      align="end"
      label="Runs on this datasheet"
      trigger={
        <Button className="max-w-72 min-w-0" ref={triggerRef} size="sm" variant="secondary">
          <span className="min-w-0 truncate max-xl:hidden">{label}</span>
          <span className="min-w-0 truncate xl:hidden">{compactLabel}</span>
          <ChevronDown aria-hidden="true" className="text-text-muted" />
        </Button>
      }
      width={400}
    >
      {({ close }) => (
        <RunSwitcherList
          {...listProps}
          onNavigate={close}
          onRunAnotherModel={() => {
            close();
            listProps.onRunAnotherModel();
          }}
        />
      )}
    </Popover>
  );
}

export type RunSwitcherSheetProps = Omit<RunSwitcherListProps, "onNavigate"> & {
  onClose: () => void;
  open: boolean;
};

/** Mobile: the same list in a bottom sheet. */
export function RunSwitcherSheet({ onClose, open, ...listProps }: RunSwitcherSheetProps) {
  return (
    <Dialog onClose={onClose} open={open} title="Runs on this datasheet" variant="sheet-bottom">
      <div className="pb-2">
        <RunSwitcherList
          {...listProps}
          heading={false}
          onNavigate={onClose}
          onRunAnotherModel={() => {
            onClose();
            listProps.onRunAnotherModel();
          }}
        />
      </div>
    </Dialog>
  );
}
