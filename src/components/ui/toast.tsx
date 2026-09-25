"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

import { AppLink } from "@/components/app-link";

import { buttonClassName } from "./button";
import { cn } from "./cn";

export type ToastTone = "neutral" | "accent" | "success" | "warning" | "danger";

export type ToastAction = {
  label: string;
  /** In-app destination; rendered through AppLink so navigation guards apply. */
  href?: string;
  onClick?: () => void;
};

export type ToastInput = {
  action?: ToastAction;
  description?: ReactNode;
  /** Auto-dismiss delay. Defaults to 5000 ms; 0 keeps the toast until dismissed. */
  durationMs?: number;
  /** Reusing an id replaces the existing toast instead of stacking a new one. */
  id?: string;
  title: ReactNode;
  tone?: ToastTone;
};

export type ToastApi = {
  dismiss: (id: string) => void;
  /** Shows a toast and returns its id. */
  show: (input: ToastInput) => string;
};

type ToastRecord = ToastInput & { id: string; version: number };

const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 5000;

const ToastContext = createContext<ToastApi | null>(null);

const fallbackApi: ToastApi = {
  dismiss: () => {},
  show: () => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "useToast() was called outside <ToastProvider>; the toast was dropped.",
      );
    }

    return "";
  },
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallbackApi;
}

const toneIcons: Record<ToastTone, ReactNode> = {
  neutral: null,
  accent: <Info className="text-accent-text" />,
  success: <CircleCheck className="text-success" />,
  warning: <TriangleAlert className="text-warning" />,
  danger: <CircleAlert className="text-danger" />,
};

/**
 * Holds the toast stack and its polite live region. Idempotent: a provider
 * nested inside another one renders its children only and defers to the
 * outer stack.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const parent = useContext(ToastContext);

  if (parent) {
    return children;
  }

  return <ToastStack>{children}</ToastStack>;
}

/**
 * The topmost open modal `<dialog>`, or null. While one is open everything
 * outside it is inert, so the toast region is portaled into it to stay
 * clickable and announced.
 */
function findTopModalDialog(): HTMLElement | null {
  try {
    const dialogs = document.querySelectorAll<HTMLElement>("dialog:modal");
    return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * The region is a `popover="manual"` element shown on mount, so it sits in
 * the top layer above page content. Showing it again (hidePopover +
 * showPopover) moves it to the top of the top layer; that happens when a
 * toast is added while a modal dialog is open. It never takes focus and is
 * left alone while focus is inside it.
 */
function raiseRegion(region: HTMLElement | null) {
  if (!region || typeof region.showPopover !== "function") {
    return;
  }

  try {
    if (region.matches(":popover-open")) {
      if (
        region.contains(document.activeElement) ||
        !document.querySelector("dialog:modal")
      ) {
        return;
      }

      region.hidePopover();
    }

    region.showPopover();
  } catch {
    // Disconnected or popover unsupported; the region still renders inline.
  }
}

/** Sentinel for "the region has not been shown in any container yet". */
const NOT_SHOWN = "not-shown";

function ToastStack({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Where the region lives: inline (null) or inside the topmost modal dialog.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // The container the current region element was shown in. Toasts render one
  // task after a (re)mount, so they are additions to an existing live region
  // and get announced.
  const [shownIn, setShownIn] = useState<HTMLElement | null | typeof NOT_SHOWN>(
    NOT_SHOWN,
  );
  const counterRef = useRef(0);
  const regionRef = useRef<HTMLElement>(null);
  // Where focus came from before entering a toast; restored when the focused
  // toast is dismissed so focus never falls back to <body> (or out of a
  // modal dialog).
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((input: ToastInput) => {
    // Raise before the toast is inserted, so the live region announces an
    // addition to an already visible region.
    raiseRegion(regionRef.current);
    counterRef.current += 1;
    const id = input.id ?? `toast-${counterRef.current}`;
    const version = counterRef.current;

    setToasts((current) => {
      const withoutSame = current.filter((toast) => toast.id !== id);
      return [...withoutSame, { ...input, id, version }].slice(
        -MAX_VISIBLE * 2,
      );
    });

    return id;
  }, []);

  useEffect(() => {
    const sync = () => setContainer(findTopModalDialog());
    const observer = new MutationObserver(sync);

    sync();
    observer.observe(document.documentElement, {
      attributeFilter: ["open"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  // Show the freshly mounted region, then let toasts render into it.
  useLayoutEffect(() => {
    raiseRegion(regionRef.current);
    const timer = window.setTimeout(() => setShownIn(container), 0);

    return () => window.clearTimeout(timer);
  }, [container]);

  const api = useMemo(() => ({ dismiss, show }), [dismiss, show]);
  const visible = shownIn === container ? toasts.slice(-MAX_VISIBLE) : [];
  const newest = toasts.at(-1);
  const newestKey = newest ? `${newest.id}-${newest.version}` : null;

  // Also covers a modal dialog opened in the same tick as `show`.
  useLayoutEffect(() => {
    raiseRegion(regionRef.current);
  }, [newestKey]);

  const region = (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-auto bottom-[calc(var(--ui-toast-offset,16px)+env(safe-area-inset-bottom))] z-[60] m-0 hidden h-auto w-auto justify-center overflow-visible border-0 bg-transparent px-4 py-0 text-text open:flex sm:inset-x-auto sm:right-(--ui-toast-offset,16px) sm:justify-end sm:px-0"
      data-toast-region=""
      onFocus={(event) => {
        const from = event.relatedTarget;

        if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
          returnFocusRef.current = from;
        }
      }}
      popover="manual"
      ref={regionRef}
    >
      <ol
        aria-live="polite"
        aria-relevant="additions text"
        className="flex w-full max-w-[380px] flex-col gap-2 sm:w-[380px]"
      >
        {visible.map((toast) => (
          <ToastItem
            key={`${toast.id}-${toast.version}`}
            onDismiss={dismiss}
            returnFocusRef={returnFocusRef}
            toast={toast}
          />
        ))}
      </ol>
    </section>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {container ? createPortal(region, container) : region}
    </ToastContext.Provider>
  );
}

function ToastItem({
  onDismiss,
  returnFocusRef,
  toast,
}: {
  onDismiss: (id: string) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  toast: ToastRecord;
}) {
  const itemRef = useRef<HTMLLIElement>(null);
  const [paused, setPaused] = useState(false);
  const duration = toast.durationMs ?? DEFAULT_DURATION_MS;
  const tone = toast.tone ?? "neutral";
  const icon = toneIcons[tone];

  useEffect(() => {
    if (paused || duration <= 0 || !Number.isFinite(duration)) {
      return;
    }

    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss, paused, toast.id]);

  const action = toast.action;
  const actionClassName = buttonClassName({
    size: "sm",
    variant: "plain",
    className: "font-semibold",
  });

  function dismissSelf() {
    const target = returnFocusRef.current;

    if (
      itemRef.current?.contains(document.activeElement) &&
      target?.isConnected
    ) {
      target.focus({ preventScroll: true });
    }

    onDismiss(toast.id);
  }

  function runAction() {
    action?.onClick?.();
    dismissSelf();
  }

  return (
    <li
      className="pointer-events-auto flex items-start gap-3 rounded-md bg-surface py-3 pr-2 pl-4 shadow-overlay motion-safe:animate-toast-in"
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      ref={itemRef}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mt-0.5 flex shrink-0 [&_svg]:size-4"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 py-px">
        <p className="text-body font-medium text-text">{toast.title}</p>
        {toast.description ? (
          <div className="mt-0.5 text-callout text-text-muted">
            {toast.description}
          </div>
        ) : null}
      </div>
      {action ? (
        action.href ? (
          <AppLink
            className={cn(actionClassName, "mt-0.5")}
            href={action.href}
            onClick={runAction}
          >
            {action.label}
          </AppLink>
        ) : (
          <button
            className={cn(actionClassName, "mt-0.5")}
            onClick={runAction}
            type="button"
          >
            {action.label}
          </button>
        )
      ) : null}
      <button
        aria-label="Dismiss notification"
        className="flex size-6 shrink-0 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-text pointer-coarse:size-11"
        onClick={dismissSelf}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </li>
  );
}
