import { Check, CircleDashed, Pencil } from "lucide-react";

import { cn } from "@/components/ui";
import type { ReviewDecisionStatus } from "@/lib/submissions/types";

export type DecisionGlyphProps = {
  className?: string;
  decision: ReviewDecisionStatus;
};

/**
 * 18 px decision status mark in a 20 px column (§5.2). Pending is a dashed
 * grey ring, confirmed a filled green circle with a check, corrected a filled
 * red circle with a pencil. Decorative: the row's accessible name carries the
 * status.
 */
export function DecisionGlyph({ className, decision }: DecisionGlyphProps) {
  if (decision === "pending") {
    return (
      <span aria-hidden="true" className={cn("flex size-5 items-center justify-center", className)}>
        <CircleDashed className="size-[18px] text-pending" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={cn("flex size-5 items-center justify-center", className)}>
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-pill text-white transition-colors duration-(--ui-duration-fast) ease-ui",
          decision === "confirmed" ? "bg-success" : "bg-danger",
        )}
      >
        {decision === "confirmed" ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <Pencil className="size-2.5" strokeWidth={2.75} />
        )}
      </span>
    </span>
  );
}
