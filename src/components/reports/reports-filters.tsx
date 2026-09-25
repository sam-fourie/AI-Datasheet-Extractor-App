"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge, SegmentedControl, SelectField, Spinner } from "@/components/ui";
import type { PackageCategory } from "@/lib/package-categories";
import {
  serializeReportsQuery,
  type ReportsQuery,
  type ReportsRange,
} from "@/lib/submissions/reports";

import { formatEffortName, formatModelName } from "./report-format";

const RANGE_OPTIONS: Array<{ label: string; value: ReportsRange }> = [
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "All time", value: "all" },
];

export type ReportsFiltersProps = {
  categories: PackageCategory[];
  /** Resolved chip for `datasheet=`; null part number when the id is unknown. */
  datasheet: { partNumber: string | null; submissionId: string } | null;
  efforts: string[];
  models: string[];
  query: ReportsQuery;
};

/**
 * One row of filters above every section. State lives in the URL: each change
 * replaces the query string (no new history entry, no scroll jump) and the
 * server page re-renders against the new scope.
 */
export function ReportsFilters({
  categories,
  datasheet,
  efforts,
  models,
  query,
}: ReportsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(patch: Partial<ReportsQuery>) {
    const search = serializeReportsQuery({ ...query, ...patch });

    startTransition(() => {
      // The Reports page registers no navigation guard, and a same-page query
      // change must not scroll, so this uses the router directly.
      router.replace(`/reports${search ? `?${search}` : ""}`, { scroll: false });
    });
  }

  // Keep a selected value visible even if it is not in the data any more.
  const modelOptions =
    query.model && !models.includes(query.model) ? [...models, query.model] : models;
  const effortOptions =
    query.effort && !efforts.includes(query.effort) ? [...efforts, query.effort] : efforts;
  const categoryOptions =
    query.category && !categories.includes(query.category)
      ? [...categories, query.category]
      : categories;

  return (
    <div
      aria-busy={isPending || undefined}
      aria-label="Report filters"
      className="flex flex-wrap items-center gap-2"
      role="group"
    >
      <SegmentedControl<ReportsRange>
        aria-label="Date range"
        className="w-full sm:w-auto"
        fullWidth
        name="range"
        onChange={(range) => update({ range })}
        options={RANGE_OPTIONS}
        value={query.range}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
        <label className="sr-only" htmlFor="reports-model">
          Model
        </label>
        <SelectField
          className="min-w-0 flex-1 basis-36 sm:w-44 sm:flex-none"
          id="reports-model"
          onChange={(event) => update({ model: event.target.value || null })}
          value={query.model ?? ""}
        >
          <option value="">All models</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {formatModelName(model)}
            </option>
          ))}
        </SelectField>
        <label className="sr-only" htmlFor="reports-effort">
          Effort
        </label>
        <SelectField
          className="min-w-0 flex-1 basis-36 sm:w-36 sm:flex-none"
          id="reports-effort"
          onChange={(event) => update({ effort: event.target.value || null })}
          value={query.effort ?? ""}
        >
          <option value="">All efforts</option>
          {effortOptions.map((effort) => (
            <option key={effort} value={effort}>
              {formatEffortName(effort) ?? effort}
            </option>
          ))}
        </SelectField>
        <label className="sr-only" htmlFor="reports-category">
          Category
        </label>
        <SelectField
          className="min-w-0 flex-1 basis-48 sm:w-52 sm:flex-none"
          id="reports-category"
          onChange={(event) =>
            update({ category: (event.target.value || null) as PackageCategory | null })
          }
          value={query.category ?? ""}
        >
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </SelectField>
      </div>
      {datasheet ? (
        <button
          aria-label={`Remove datasheet filter: ${datasheet.partNumber ?? "unknown datasheet"}`}
          className="group/chip inline-flex items-center rounded-xs pointer-coarse:min-h-11"
          onClick={() => update({ datasheet: null })}
          type="button"
        >
          <Badge
            className="gap-1 pr-1 group-hover/chip:brightness-95"
            tone="accent"
          >
            <span className="max-w-48 truncate font-mono">
              {datasheet.partNumber ?? "Unknown datasheet"}
            </span>
            <X aria-hidden="true" className="size-3.5" />
          </Badge>
        </button>
      ) : null}
      {isPending ? <Spinner className="text-text-muted" label="Updating reports" /> : null}
    </div>
  );
}
