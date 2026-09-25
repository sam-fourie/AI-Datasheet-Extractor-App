"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { useNavigationGuard } from "@/components/navigation-blocker-provider";
import { useToast, type ToastInput } from "@/components/ui";

/**
 * App-wide tracker for work that outlives the page that started it, today
 * only model re-runs (spec §3.4, addendum E). It lives in the root layout, so
 * the fetch survives client navigations. While a task runs, an unload-level
 * guard warns before the tab closes; in-app navigation stays free.
 */

export const MAX_CONCURRENT_BACKGROUND_TASKS = 3;

/** Identical starts (same group and label) closer than this are treated as one. */
const DUPLICATE_START_WINDOW_MS = 2000;

export type BackgroundTaskKind = "rerun";

export type BackgroundTaskStatus = "running" | "succeeded" | "failed";

export type BackgroundTask = {
  error?: string;
  /** The root baseline id the task belongs to. */
  groupId: string;
  id: string;
  kind: BackgroundTaskKind;
  /** Short label, e.g. "Sol · High". */
  label: string;
  /** Where the finished result lives, e.g. "/submissions/abc". */
  resultHref?: string;
  startedAt: number;
  status: BackgroundTaskStatus;
};

export type BackgroundTaskSuccess = {
  href?: string;
  /** Replaces the default "{label} finished" toast. */
  toast?: ToastInput;
};

export type BackgroundTaskContext = {
  /**
   * The id of the attempt that failed. A retry starts a new task with the same
   * input, so this is the id to pass to `retry` from the failure toast.
   */
  taskId: string;
};

export type StartBackgroundTaskInput<T> = {
  groupId: string;
  kind: BackgroundTaskKind;
  label: string;
  onError?: (error: unknown, context: BackgroundTaskContext) => ToastInput;
  onSuccess?: (result: T) => BackgroundTaskSuccess;
  run: (signal: AbortSignal) => Promise<T>;
};

export type BackgroundTasksApi = {
  /** Removes a finished task. Running tasks cannot be dismissed or cancelled. */
  dismiss: (id: string) => void;
  /** True while any task for `groupId` is running. */
  isGroupBusy: (groupId: string) => boolean;
  /** Starts the same work again for a failed task. Same return as startTask. */
  retry: (id: string) => string | null;
  /**
   * Returns the task id, or null when 3 tasks are already running. A second
   * start of the same group and label within 2 s of a running one returns the
   * running task's id instead of starting a duplicate.
   */
  startTask: <T>(input: StartBackgroundTaskInput<T>) => string | null;
  tasks: BackgroundTask[];
};

const unloadGuard = {
  description: "A model run is still in progress. Leaving now may lose it.",
  leaveLabel: "Leave",
  level: "unload",
  title: "A model run is still in progress",
} as const;

const BackgroundTasksContext = createContext<BackgroundTasksApi | null>(null);

const emptyApi: BackgroundTasksApi = {
  dismiss: () => {},
  isGroupBusy: () => false,
  retry: () => null,
  startTask: () => null,
  tasks: [],
};

export function useBackgroundTasks(): BackgroundTasksApi {
  return useContext(BackgroundTasksContext) ?? emptyApi;
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return typeof error === "string" && error ? error : "Something went wrong.";
}

let taskCounter = 0;

function createTaskId() {
  taskCounter += 1;
  return `task-${Date.now().toString(36)}-${taskCounter}`;
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const runningRef = useRef(
    new Map<
      string,
      { controller: AbortController; groupId: string; label: string; startedAt: number }
    >(),
  );
  // Inputs of failed or running tasks, so a failed one can be retried.
  const inputsRef = useRef(new Map<string, StartBackgroundTaskInput<unknown>>());
  const hasRunningTask = tasks.some((task) => task.status === "running");

  useNavigationGuard(hasRunningTask ? unloadGuard : null);

  useEffect(() => {
    const running = runningRef.current;

    return () => {
      running.forEach(({ controller }) => controller.abort());
      running.clear();
    };
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<BackgroundTask>) => {
      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
      );
    },
    [],
  );

  const startTask = useCallback(
    <T,>(input: StartBackgroundTaskInput<T>): string | null => {
      const now = Date.now();

      // Guards against double submits (a double click, a repeated shortcut).
      for (const [runningId, running] of runningRef.current) {
        if (
          running.groupId === input.groupId &&
          running.label === input.label &&
          now - running.startedAt < DUPLICATE_START_WINDOW_MS
        ) {
          return runningId;
        }
      }

      if (runningRef.current.size >= MAX_CONCURRENT_BACKGROUND_TASKS) {
        return null;
      }

      const id = createTaskId();
      const controller = new AbortController();
      const task: BackgroundTask = {
        groupId: input.groupId,
        id,
        kind: input.kind,
        label: input.label,
        startedAt: now,
        status: "running",
      };

      runningRef.current.set(id, {
        controller,
        groupId: input.groupId,
        label: input.label,
        startedAt: now,
      });
      inputsRef.current.set(id, input as StartBackgroundTaskInput<unknown>);
      setTasks((current) => [...current, task]);

      void (async () => {
        try {
          const result = await input.run(controller.signal);

          if (controller.signal.aborted) {
            return;
          }

          const success = input.onSuccess?.(result) ?? {};
          const href = success.href;
          const toastInput: ToastInput = success.toast
            ? {
                ...success.toast,
                action:
                  success.toast.action ??
                  (href ? { href, label: "Open run" } : undefined),
              }
            : {
                action: href ? { href, label: "Open run" } : undefined,
                durationMs: 8000,
                title: `${input.label} finished`,
                tone: "success",
              };

          inputsRef.current.delete(id);
          updateTask(id, { resultHref: href, status: "succeeded" });
          toast.show({ id: `background-task-${id}`, ...toastInput });
          router.refresh();
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          const message = describeError(error);
          const toastInput: ToastInput = input.onError?.(error, { taskId: id }) ?? {
            description: message,
            durationMs: 8000,
            title: `${input.label} run failed`,
            tone: "danger",
          };

          updateTask(id, { error: message, status: "failed" });
          toast.show({ id: `background-task-${id}`, ...toastInput });
        } finally {
          runningRef.current.delete(id);
        }
      })();

      return id;
    },
    [router, toast, updateTask],
  );

  const dismiss = useCallback((id: string) => {
    if (runningRef.current.has(id)) {
      return;
    }

    inputsRef.current.delete(id);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const retry = useCallback(
    (id: string) => {
      const input = inputsRef.current.get(id);

      if (!input || runningRef.current.has(id)) {
        return null;
      }

      const nextId = startTask(input);

      if (nextId) {
        inputsRef.current.delete(id);
        setTasks((current) => current.filter((task) => task.id !== id));
      }

      return nextId;
    },
    [startTask],
  );

  const isGroupBusy = useCallback(
    (groupId: string) =>
      tasks.some((task) => task.status === "running" && task.groupId === groupId),
    [tasks],
  );

  const api = useMemo<BackgroundTasksApi>(
    () => ({ dismiss, isGroupBusy, retry, startTask, tasks }),
    [dismiss, isGroupBusy, retry, startTask, tasks],
  );

  return (
    <BackgroundTasksContext.Provider value={api}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}
