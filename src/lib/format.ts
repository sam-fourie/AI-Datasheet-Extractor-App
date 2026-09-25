/**
 * Pure display formatters shared by server and client components. All output
 * is en-US in the runtime's local time zone, so render relative and absolute
 * times inside `<time suppressHydrationWarning>` (see RelativeTime).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const RECENT_HOURS = 6;
const INVALID_DATE_TEXT = "Unknown date";

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function toDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * "just now", "5 min ago", "3 h ago", "Yesterday", "Sep 21", "Mar 27, 2025".
 *
 * Hours are used for anything under 6 h, and for the rest of the same day.
 * The previous calendar day is "Yesterday". Older dates show the month and
 * day, plus the year when it differs from `now`. Future times within a minute
 * (clock skew) read "just now"; later ones show the date.
 */
export function formatRelativeTime(iso: string | Date, now: Date = new Date()) {
  const date = toDate(iso);

  if (!date) {
    return INVALID_DATE_TEXT;
  }

  const diffMs = now.getTime() - date.getTime();

  if (diffMs < MINUTE_MS && diffMs > -MINUTE_MS) {
    return "just now";
  }

  if (diffMs > 0) {
    if (diffMs < HOUR_MS) {
      return `${Math.floor(diffMs / MINUTE_MS)} min ago`;
    }

    const dayDiff = Math.round(
      (startOfLocalDay(now) - startOfLocalDay(date)) / (24 * HOUR_MS),
    );

    if (diffMs < RECENT_HOURS * HOUR_MS || dayDiff === 0) {
      return `${Math.floor(diffMs / HOUR_MS)} h ago`;
    }

    if (dayDiff === 1) {
      return "Yesterday";
    }
  }

  return date.getFullYear() === now.getFullYear()
    ? monthDayFormatter.format(date)
    : monthDayYearFormatter.format(date);
}

/** "Sep 21, 2026, 3:04 PM". */
export function formatDateTime(iso: string | Date) {
  const date = toDate(iso);
  return date ? dateTimeFormatter.format(date) : INVALID_DATE_TEXT;
}

/**
 * "0 B", "512 B", "12 KB", "1.8 MB". Uses 1024-based units to match the
 * upload limit (MAX_PDF_BYTES = 50 × 1024 × 1024 reads "50 MB"). One decimal
 * below 10 units, whole numbers above.
 */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} B`;
  }

  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);

  // 1023.96 KB rounds to 1024; promote so we never print "1024 KB".
  if (rounded >= 1024 && unitIndex < units.length - 1) {
    return `1 ${units[unitIndex + 1]}`;
  }

  return `${rounded} ${units[unitIndex]}`;
}

/** Stopwatch time: "0:34", "12:05", "1:02:03". Negative input reads "0:00". */
export function formatElapsed(ms: number) {
  const totalSeconds = Number.isFinite(ms)
    ? Math.max(0, Math.floor(ms / 1000))
    : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}
