import { Callout, LinkButton } from "@/components/ui";

export type ReportsEmptyStateProps = {
  /** Href that keeps the sort but drops every filter. */
  clearFiltersHref: string;
  kind: "no-reviews" | "no-matches";
};

/**
 * Page-level notices (spec §4.4): nothing reviewed yet anywhere, or the
 * current filters leave no runs.
 */
export function ReportsEmptyState({ clearFiltersHref, kind }: ReportsEmptyStateProps) {
  if (kind === "no-reviews") {
    return (
      <Callout
        actions={
          <LinkButton href="/submissions?status=needs-review" size="sm" variant="primary">
            Go to review queue
          </LinkButton>
        }
        role="note"
        title="Review a datasheet to see accuracy."
        tone="accent"
      >
        Accuracy and agreement are measured against reviewed datasheets.
      </Callout>
    );
  }

  return (
    <Callout
      actions={
        <LinkButton href={clearFiltersHref} replace size="sm">
          Clear filters
        </LinkButton>
      }
      role="status"
      title="No runs match these filters."
    >
      Widen the date range or clear a filter to see results.
    </Callout>
  );
}
