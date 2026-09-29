"use client";

import { useBackgroundTasks } from "@/components/background-tasks-provider";
import { RelativeTime } from "@/components/relative-time";
import { Callout, Spinner } from "@/components/ui";

/**
 * Extractions still running in the background after the person left this
 * page and came back. Shown above the form so nobody starts the same one
 * twice. Each ends in a toast that links to its review.
 */
export function RunningExtractions() {
  const { tasks } = useBackgroundTasks();
  const running = tasks.filter((task) => task.kind === "extraction" && task.status === "running");

  if (running.length === 0) {
    return null;
  }

  return (
    <Callout
      icon={<Spinner size={16} />}
      role="status"
      title={running.length === 1 ? "Still extracting" : `Still extracting ${running.length} datasheets`}
      tone="accent"
    >
      <ul className="space-y-0.5">
        {running.map((task) => (
          <li key={task.id}>
            <span className="font-mono">{task.label}</span>
            <span className="text-text-muted">
              {" · started "}
              <RelativeTime iso={new Date(task.startedAt)} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-text-muted">We&apos;ll let you know when each one is ready to review.</p>
    </Callout>
  );
}
