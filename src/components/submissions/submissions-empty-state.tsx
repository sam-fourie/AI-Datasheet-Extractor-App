import { Inbox, Plus, Search } from "lucide-react";

import { Card, EmptyState, LinkButton } from "@/components/ui";

import { SUBMISSIONS_PATH } from "./datasheet-list-format";

export type SubmissionsEmptyStateProps = {
  /** "empty": nothing saved yet. "no-match": the filters hide everything. */
  variant: "empty" | "no-match";
};

export function SubmissionsEmptyState({ variant }: SubmissionsEmptyStateProps) {
  if (variant === "empty") {
    return (
      <Card padding="none">
        <EmptyState
          action={
            <LinkButton href="/" size="md" variant="primary">
              <Plus aria-hidden="true" />
              New extraction
            </LinkButton>
          }
          description="Extract your first datasheet to start reviewing."
          icon={<Inbox />}
          title="No datasheets yet"
        />
      </Card>
    );
  }

  return (
    <Card data-datasheet-list="" padding="none">
      <EmptyState
        action={
          <LinkButton href={SUBMISSIONS_PATH} replace size="md" variant="secondary">
            Clear filters
          </LinkButton>
        }
        icon={<Search />}
        title="No datasheets match these filters"
      />
    </Card>
  );
}
