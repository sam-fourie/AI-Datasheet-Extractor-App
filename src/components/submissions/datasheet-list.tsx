import { AppLink } from "@/components/app-link";
import { buttonClassName, Card, Table, Th, THead, Tr } from "@/components/ui";
import { DATASHEET_LIST_PAGE_SIZE } from "@/lib/submissions/list-query";
import type {
  DatasheetListQuery,
  DatasheetListResult,
} from "@/lib/submissions/types";

import { buildListHref } from "./datasheet-list-format";
import { DatasheetRowGroup } from "./datasheet-row";
import { RowActionsProvider } from "./row-actions-menu";

export type DatasheetListProps = {
  query: DatasheetListQuery;
  result: DatasheetListResult;
};

/**
 * The datasheet table: one card, one `<tbody>` per group. Rendered on the
 * server; only the runs disclosure and the row menus are client islands. 
 */
export function DatasheetList({ query, result }: DatasheetListProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Card
        className="w-full overflow-clip transition-opacity duration-(--ui-duration) ease-ui"
        data-datasheet-list=""
        padding="none"
      >
        <RowActionsProvider>
          <Table
            caption="Submissions"
            className="md:table-fixed"
            scrollX={false}
            stickyHeader
          >
            <THead className="max-md:hidden">
              <Tr>
                <Th>Datasheet</Th>
                <Th className="w-[18%]">Review</Th>
                {/* Below xl, Runs takes most of the width the hidden Model column frees. */}
                <Th className="w-[24%] xl:w-[15%]">Runs</Th>
                <Th className="hidden w-[13%] xl:table-cell">Model</Th>
                <Th className="w-[12%]">Updated</Th>
                <Th className="w-12">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            {result.groups.map((group) => (
              <DatasheetRowGroup
                group={group}
                key={group.baseline.submissionId}
                query={query}
              />
            ))}
          </Table>
        </RowActionsProvider>
      </Card>
      {result.hasMore ? (
        <AppLink
          className={buttonClassName({ variant: "plain" })}
          href={buildListHref({
            ...query,
            limit: query.limit + DATASHEET_LIST_PAGE_SIZE,
          })}
          replace
          scroll={false}
        >
          Show more
        </AppLink>
      ) : null}
    </div>
  );
}
