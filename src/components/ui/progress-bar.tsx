import { cn } from "./cn";

export type ProgressTone =
  "success" | "danger" | "warning" | "accent" | "neutral";
export type ProgressSegment = { tone: ProgressTone; value: number };

export type ProgressBarProps = {
  className?: string;
  /** Accessible name, e.g. "Review progress". */
  label: string;
  segments: ProgressSegment[];
  total: number;
  /** Spoken value, e.g. "12 of 19 decided". Defaults to a percentage. */
  valueText?: string;
  variant?: "hairline" | "sm" | "md";
};

const toneClassNames: Record<ProgressTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  accent: "bg-accent",
  neutral: "bg-pending",
};

const variantClassNames = {
  hairline: "h-[3px]",
  sm: "h-1",
  md: "h-1.5",
} as const;

/** Determinate bar with stacked segments on a muted track. */
export function ProgressBar({
  className,
  label,
  segments,
  total,
  valueText,
  variant = "sm",
}: ProgressBarProps) {
  const safeTotal = Math.max(0, total);
  const sum = segments.reduce(
    (accumulator, segment) => accumulator + Math.max(0, segment.value),
    0,
  );
  const now = Math.min(sum, safeTotal);

  return (
    <div
      aria-label={label}
      aria-valuemax={safeTotal}
      aria-valuemin={0}
      aria-valuenow={now}
      aria-valuetext={valueText}
      className={cn(
        "flex w-full overflow-hidden rounded-pill bg-surface-muted",
        variantClassNames[variant],
        className,
      )}
      role="progressbar"
    >
      {safeTotal > 0
        ? segments.map((segment, index) =>
            segment.value > 0 ? (
              <span
                className={cn(
                  "h-full shrink-0 transition-[width] duration-(--ui-duration-slow) ease-ui",
                  toneClassNames[segment.tone],
                )}
                key={index}
                style={{
                  width: `${(Math.max(0, segment.value) / safeTotal) * 100}%`,
                }}
              />
            ) : null,
          )
        : null}
    </div>
  );
}
