import { cn } from "./cn";

export type ControlSize = "md" | "lg";

/**
 * Shared look for text inputs, selects and textareas. Invalid state is a red
 * border only (no fill); the error line is rendered by `Field`.
 */
const baseControlClassName =
  "block w-full min-w-0 rounded-sm border border-control-border bg-surface text-body text-text transition-[border-color,background-color] duration-(--ui-duration-fast) ease-ui placeholder:text-text-tertiary hover:border-text-muted focus-visible:border-focus focus-visible:-outline-offset-1 disabled:border-border-strong disabled:bg-surface-muted disabled:text-text-tertiary aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger pointer-coarse:text-base";

export function controlClassName(extraClassName?: string, className?: string) {
  return cn(baseControlClassName, extraClassName, className);
}

const inputSizeClassNames: Record<ControlSize, string> = {
  md: "h-8 px-3 pointer-coarse:h-11",
  lg: "h-9 px-3 pointer-coarse:h-11",
};

export function inputControlClassName(size: ControlSize = "md") {
  return inputSizeClassNames[size];
}

export function selectControlClassName(size: ControlSize = "md") {
  return cn(inputSizeClassNames[size], "appearance-none pr-9");
}

export const textAreaControlClassName = "min-h-20 resize-y px-3 py-2";
