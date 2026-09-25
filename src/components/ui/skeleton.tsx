import { cn } from "./cn";

export type SkeletonProps = {
  className?: string;
};

/** Unprefixed height or size utility, e.g. `h-8`, `h-[3px]` or `size-6`. */
const HEIGHT_CLASS_PATTERN = /(?:^|\s)!?(?:h|size)-\S/;

/**
 * Placeholder block, 16 px tall unless `className` sets its own `h-*` or
 * `size-*` (the default is dropped then, so the caller's height always wins).
 */
export function Skeleton({ className }: SkeletonProps) {
  const hasHeight = className ? HEIGHT_CLASS_PATTERN.test(className) : false;

  return (
    <div
      aria-hidden="true"
      className={cn(
        !hasHeight && "h-4",
        "rounded-xs bg-surface-muted motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

export type SkeletonTextProps = {
  className?: string;
  lines?: number;
};

export function SkeletonText({ className, lines = 3 }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Skeleton
          className={cn(
            "h-3.5",
            index === lines - 1 && lines > 1 ? "w-3/5" : "w-full",
          )}
          key={index}
        />
      ))}
    </div>
  );
}
