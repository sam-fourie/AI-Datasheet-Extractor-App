import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { AppPageLayout } from "@/components/app-page-layout";
import { DatasheetList } from "@/components/submissions/datasheet-list";
import { formatListMeta } from "@/components/submissions/datasheet-list-format";
import { SubmissionsEmptyState } from "@/components/submissions/submissions-empty-state";
import { SubmissionsToolbar } from "@/components/submissions/submissions-toolbar";
import { LinkButton } from "@/components/ui";
import { listDatasheetGroups, parseDatasheetListQuery } from "@/lib/submissions";
import type { SearchParamsRecord } from "@/lib/submissions/list-query";

export const metadata: Metadata = {
  title: "Submissions",
};

type SubmissionsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function SubmissionsPage({ searchParams }: SubmissionsPageProps) {
  const query = parseDatasheetListQuery(await searchParams);
  const isScoped = query.q !== "" || query.category !== null;

  const result = await listDatasheetGroups(query);
  // The list's counts follow q and category; the header always shows totals.
  const { totals } = result;
  const isEmpty =
    totals.all === 0 &&
    result.groups.length === 0 &&
    !isScoped &&
    query.status === "all";

  return (
    <AppPageLayout
      action={
        isEmpty ? null : (
          <LinkButton href="/" size="sm" variant="primary">
            <Plus aria-hidden="true" />
            New extraction
          </LinkButton>
        )
      }
      bodyClassName="[&:has([data-list-pending])_[data-datasheet-list]]:opacity-60"
      meta={isEmpty ? null : formatListMeta(totals)}
      title="Submissions"
    >
      {isEmpty ? (
        <SubmissionsEmptyState variant="empty" />
      ) : (
        <>
          <SubmissionsToolbar
            categories={result.categories}
            counts={result.counts}
            query={query}
          />
          {result.groups.length > 0 ? (
            <DatasheetList query={query} result={result} />
          ) : (
            <SubmissionsEmptyState variant="no-match" />
          )}
        </>
      )}
    </AppPageLayout>
  );
}
