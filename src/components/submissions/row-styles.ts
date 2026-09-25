import { cn } from "@/components/ui";

/**
 * A link whose ::after covers its whole `<tr>` (the row must be `relative`),
 * so the entire row is clickable with one tab stop. The focus outline is drawn
 * on the pseudo-element so it frames the full row. Other controls in the row
 * sit above it with `relative z-10`.
 */
export function stretchedLinkClassName(className?: string) {
  return cn(
    "outline-none after:absolute after:inset-0 after:content-['']",
    "focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus focus-visible:after:rounded-xs",
    className,
  );
}
