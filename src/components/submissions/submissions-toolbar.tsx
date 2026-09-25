"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Check } from "lucide-react";

import {
  Button,
  Menu,
  SearchField,
  SegmentedControl,
  SelectField,
  type MenuEntry,
} from "@/components/ui";
import type { PackageCategory } from "@/lib/package-categories";
import {
  DEFAULT_DATASHEET_LIST_QUERY,
  isPackageCategory,
  serializeDatasheetListQuery,
} from "@/lib/submissions/list-query";
import type {
  DatasheetListQuery,
  DatasheetListResult,
  DatasheetListSort,
  DatasheetListStatus,
} from "@/lib/submissions/types";

import { buildListHref, LAST_QUERY_STORAGE_KEY } from "./datasheet-list-format";
import {
  toolbarContainerClassName,
  toolbarRowClassName,
  toolbarSearchClassName,
  toolbarTrailingClassName,
} from "./toolbar-layout";

const SORT_OPTIONS: Array<{ label: string; value: DatasheetListSort }> = [
  { label: "Recent activity", value: "recent" },
  { label: "Newest", value: "newest" },
  { label: "Part number A–Z", value: "part" },
  { label: "Most pending", value: "pending" },
];

/** Short labels for the phone-width native select, which has little room. */
const MOBILE_SORT_LABELS: Record<DatasheetListSort, string> = {
  newest: "Newest",
  part: "Part A–Z",
  pending: "Most pending",
  recent: "Recent",
};

export type SubmissionsToolbarProps = {
  categories: PackageCategory[];
  counts: DatasheetListResult["counts"];
  query: DatasheetListQuery;
};

/**
 * Search, status, category and sort for /submissions. The URL is the source
 * of truth (router.replace, no history entries); local state only makes the
 * controls respond before the server render arrives.
 */
export function SubmissionsToolbar({
  categories,
  counts,
  query,
}: SubmissionsToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const serverKey = serializeDatasheetListQuery(query);
  const [state, setState] = useState(query);
  const [syncedKey, setSyncedKey] = useState(serverKey);

  // Adopt URL changes made elsewhere (Back, "Clear filters", "Show all").
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setState(query);
  }

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LAST_QUERY_STORAGE_KEY, serverKey);
    } catch {
      // Storage unavailable (private mode, blocked); the back link falls back to /submissions.
    }
  }, [serverKey]);

  function update(patch: Partial<DatasheetListQuery>) {
    // Any filter change starts again from the first page.
    const next = {
      ...state,
      ...patch,
      limit: DEFAULT_DATASHEET_LIST_QUERY.limit,
    };

    setState(next);
    startTransition(() => {
      router.replace(buildListHref(next), { scroll: false });
    });
  }

  const categoryOptions =
    state.category && !categories.includes(state.category)
      ? [...categories, state.category]
      : categories;
  const currentSort =
    SORT_OPTIONS.find((option) => option.value === state.sort) ??
    SORT_OPTIONS[0];
  const sortItems: MenuEntry[] = SORT_OPTIONS.map((option) => ({
    icon:
      option.value === state.sort ? (
        <Check className="text-accent" />
      ) : (
        <span className="size-4" />
      ),
    label: option.label,
    onSelect: () => update({ sort: option.value }),
  }));

  return (
    <div className={toolbarContainerClassName}>
      <div
        aria-label="Filter submissions"
        className={toolbarRowClassName}
        data-list-pending={isPending ? "" : undefined}
        role="search"
      >
        <SearchField
          aria-label="Search submissions"
          className={toolbarSearchClassName}
          debounceMs={250}
          onChange={(q) => update({ q })}
          placeholder="Search part number, file or site"
          shortcutKey="/"
          value={state.q}
        />
        <SegmentedControl<DatasheetListStatus>
          aria-label="Review status"
          className="md:w-auto"
          fullWidth
          onChange={(status) => update({ status })}
          options={[
            { count: counts.all, label: "All", value: "all" },
            {
              count: counts.needsReview,
              label: "Needs review",
              value: "needs-review",
            },
            { count: counts.reviewed, label: "Reviewed", value: "reviewed" },
          ]}
          value={state.status}
        />
        <div className={toolbarTrailingClassName}>
          <SelectField
            aria-label="Package category"
            className="min-w-0 truncate md:w-48"
            onChange={(event) => {
              const value = event.target.value;

              update({
                category: value && isPackageCategory(value) ? value : null,
              });
            }}
            value={state.category ?? ""}
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
          <SelectField
            aria-label="Sort by"
            className="min-w-0 truncate md:hidden"
            onChange={(event) => {
              const option = SORT_OPTIONS.find(
                ({ value }) => value === event.target.value,
              );

              if (option) {
                update({ sort: option.value });
              }
            }}
            value={state.sort}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {MOBILE_SORT_LABELS[option.value]}
              </option>
            ))}
          </SelectField>
          <div className="max-md:hidden">
            <Menu
              align="end"
              items={sortItems}
              label="Sort by"
              trigger={
                <Button variant="secondary">
                  <ArrowUpDown aria-hidden="true" />
                  <span>
                    <span className="text-text-muted">Sort:</span>{" "}
                    {currentSort.label}
                  </span>
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
