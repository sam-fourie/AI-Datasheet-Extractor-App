import { cn } from "@/components/ui";
import { formatEvidencePages, normalizeEvidencePages } from "@/lib/submissions/evidence";

export type EvidenceChipsProps = {
  className?: string;
  /** Show at most this many chips, then "+N" (still listed for screen readers). Default 3. */
  maxChips?: number;
  /** Omit (or pass pdfAvailable=false upstream) to render plain text like "pp. 3, 30". */
  onShowPage?: (page: number) => void;
  /** 1-based evidence pages, in any order; normalised with normalizeEvidencePages. */
  pages: readonly number[] | null | undefined;
  /** Roving tabindex: false keeps the chips out of the tab order. Default true. */
  tabbable?: boolean;
};

const chipClassName =
  "inline-flex h-5 shrink-0 items-center rounded-xs bg-surface-muted px-1.5 font-mono text-caption text-text-muted tabular-nums";

/**
 * Evidence page links ("p. 30"), one chip per page. Each chip is a button that
 * shows that page of the datasheet. Renders nothing when there are no pages.
 */
export function EvidenceChips({
  className,
  maxChips = 3,
  onShowPage,
  pages,
  tabbable = true,
}: EvidenceChipsProps) {
  const normalized = normalizeEvidencePages(pages);

  if (normalized.length === 0) {
    return null;
  }

  if (!onShowPage) {
    return (
      <span className={cn(chipClassName, "bg-transparent px-0", className)}>
        {formatEvidencePages(normalized)}
      </span>
    );
  }

  const visible = normalized.slice(0, maxChips);
  const hidden = normalized.slice(maxChips);

  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-1", className)}>
      {visible.map((page) => (
        <button
          aria-label={`Show page ${page}`}
          className={cn(
            chipClassName,
            "transition-colors duration-(--ui-duration-fast) ease-ui hover:bg-accent-soft hover:text-accent-text pointer-coarse:h-7 pointer-coarse:px-2",
          )}
          key={page}
          onClick={(event) => {
            event.stopPropagation();
            onShowPage(page);
          }}
          tabIndex={tabbable ? 0 : -1}
          title={`Show page ${page}`}
          type="button"
        >
          p. {page}
        </button>
      ))}
      {hidden.length > 0 ? (
        <button
          aria-label={`Show page ${hidden[0]} (also cited: ${formatEvidencePages(hidden)})`}
          className={cn(chipClassName, "hover:bg-accent-soft hover:text-accent-text")}
          onClick={(event) => {
            event.stopPropagation();
            onShowPage(hidden[0]);
          }}
          tabIndex={tabbable ? 0 : -1}
          title={formatEvidencePages(hidden) ?? undefined}
          type="button"
        >
          +{hidden.length}
        </button>
      ) : null}
    </span>
  );
}
