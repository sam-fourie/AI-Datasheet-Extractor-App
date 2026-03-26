import { cn } from "./cn";

const baseControlClassName =
  "block w-full rounded-control border bg-surface text-[15px] tracking-[-0.01em] text-text shadow-soft outline-none transition duration-150 ease-out placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring disabled:bg-surface-muted disabled:text-text-muted disabled:shadow-none aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger-ring";

export function controlClassName(extraClassName?: string, className?: string) {
  return cn(baseControlClassName, extraClassName, className);
}

export const inputControlClassName = "h-11 px-4";

export const textAreaControlClassName = "min-h-32 resize-y px-4 py-3";

export const selectControlClassName = "h-11 appearance-none px-4 pr-11";
