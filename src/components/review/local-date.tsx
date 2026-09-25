"use client";

import { useSyncExternalStore } from "react";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function subscribeNever() {
  return () => {};
}

/**
 * "Sep 21, 2026" in the viewer's time zone. The server render shows the UTC
 * date, and the element re-renders with the local date after hydration, so
 * the two never mismatch.
 */
export function LocalDate({ className, iso }: { className?: string; iso: string }) {
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <time className={className} dateTime={iso} key={isClient ? "local" : "utc"} suppressHydrationWarning>
      {isClient ? dateFormatter.format(date) : date.toISOString().slice(0, 10)}
    </time>
  );
}
