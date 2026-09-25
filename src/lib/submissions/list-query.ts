import {
  PACKAGE_CATEGORY_FIELDS,
  type PackageCategory,
} from "@/lib/package-categories";
import type {
  DatasheetListQuery,
  DatasheetListSort,
  DatasheetListStatus,
} from "@/lib/submissions/types";

/**
 * URL state of the /submissions list. Parsing never throws: unknown or invalid
 * values fall back to the defaults, and serializing omits defaults so clean
 * URLs stay clean.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export const DATASHEET_LIST_PAGE_SIZE = 100;

/** Upper bound for ?limit= so a hand-edited URL can't request everything at once. */
export const DATASHEET_LIST_MAX_LIMIT = 2_000;

const MAX_QUERY_LENGTH = 200;

export const DATASHEET_LIST_STATUSES = [
  "all",
  "needs-review",
  "reviewed",
] as const satisfies readonly DatasheetListStatus[];

export const DATASHEET_LIST_SORTS = [
  "recent",
  "newest",
  "part",
  "pending",
] as const satisfies readonly DatasheetListSort[];

export const DEFAULT_DATASHEET_LIST_QUERY: DatasheetListQuery = {
  category: null,
  limit: DATASHEET_LIST_PAGE_SIZE,
  q: "",
  sort: "recent",
  status: "all",
};

/** First value of a search param, or undefined. */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isPackageCategory(value: string): value is PackageCategory {
  return Object.prototype.hasOwnProperty.call(PACKAGE_CATEGORY_FIELDS, value);
}

function pickEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function parseLimit(value: string | undefined) {
  if (value === undefined || !/^\d+$/.test(value.trim())) {
    return DATASHEET_LIST_PAGE_SIZE;
  }

  const limit = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    return DATASHEET_LIST_PAGE_SIZE;
  }

  return Math.min(limit, DATASHEET_LIST_MAX_LIMIT);
}

export function parseDatasheetListQuery(searchParams: SearchParamsRecord): DatasheetListQuery {
  const q = (firstSearchParam(searchParams.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const category = firstSearchParam(searchParams.category)?.trim();

  return {
    category: category && isPackageCategory(category) ? category : null,
    limit: parseLimit(firstSearchParam(searchParams.limit)),
    q,
    sort: pickEnum(
      firstSearchParam(searchParams.sort),
      DATASHEET_LIST_SORTS,
      DEFAULT_DATASHEET_LIST_QUERY.sort,
    ),
    status: pickEnum(
      firstSearchParam(searchParams.status),
      DATASHEET_LIST_STATUSES,
      DEFAULT_DATASHEET_LIST_QUERY.status,
    ),
  };
}

/**
 * Query string without the leading "?" (empty for the defaults). Keys appear
 * in a fixed order: q, status, category, sort, limit.
 */
export function serializeDatasheetListQuery(query: Partial<DatasheetListQuery>): string {
  const params = new URLSearchParams();
  const q = query.q?.trim() ?? "";

  if (q) {
    params.set("q", q);
  }

  if (query.status && query.status !== DEFAULT_DATASHEET_LIST_QUERY.status) {
    params.set("status", query.status);
  }

  if (query.category) {
    params.set("category", query.category);
  }

  if (query.sort && query.sort !== DEFAULT_DATASHEET_LIST_QUERY.sort) {
    params.set("sort", query.sort);
  }

  if (
    typeof query.limit === "number" &&
    Number.isFinite(query.limit) &&
    query.limit !== DEFAULT_DATASHEET_LIST_QUERY.limit
  ) {
    params.set("limit", String(query.limit));
  }

  return params.toString();
}
