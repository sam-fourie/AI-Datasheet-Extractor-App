"use client";

import { useSyncExternalStore } from "react";

import { formatDateTime, formatRelativeTime } from "@/lib/format";

export type RelativeTimeProps = {
  className?: string;
  iso: string | Date;
};

const TICK_MS = 30_000;

let currentNow = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  currentNow = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  currentNow = Date.now();

  if (timer === null) {
    timer = window.setInterval(notify, TICK_MS);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (currentNow === 0) {
    currentNow = Date.now();
  }

  return currentNow;
}

function getServerSnapshot() {
  return null;
}

/**
 * `<time>` showing "5 min ago" with the absolute date in the title. The server
 * render uses the server clock and time zone; once mounted, the element is
 * re-created with the viewer's local time and refreshes every 30 s.
 */
export function RelativeTime({ className, iso }: RelativeTimeProps) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isLive = typeof now === "number" && now > 0;
  const dateTime =
    iso instanceof Date
      ? Number.isNaN(iso.getTime())
        ? undefined
        : iso.toISOString()
      : iso;

  return (
    <time
      className={className}
      dateTime={dateTime}
      // Re-create the element once live so no server-time text survives hydration.
      key={isLive ? "live" : "server"}
      suppressHydrationWarning
      title={formatDateTime(iso)}
    >
      {formatRelativeTime(iso, isLive ? new Date(now) : undefined)}
    </time>
  );
}
