import { CircleDashed, LoaderCircle } from "lucide-react";

import { cn } from "./cn";

export type SpinnerProps = {
  className?: string;
  /** When set, the spinner is announced as a status with this text. */
  label?: string;
  size?: number;
};

/** Spins with motion allowed; a static dashed circle under reduced motion. */
export function Spinner({ className, label, size = 16 }: SpinnerProps) {
  const glyphs = (
    <>
      <LoaderCircle
        aria-hidden="true"
        className={cn(
          "motion-safe:animate-spin motion-reduce:hidden",
          className,
        )}
        size={size}
        style={{ height: size, width: size }}
      />
      <CircleDashed
        aria-hidden="true"
        className={cn("hidden motion-reduce:block", className)}
        size={size}
        style={{ height: size, width: size }}
      />
    </>
  );

  if (!label) {
    return glyphs;
  }

  return (
    <span className="inline-flex items-center" role="status">
      {glyphs}
      <span className="sr-only">{label}</span>
    </span>
  );
}
