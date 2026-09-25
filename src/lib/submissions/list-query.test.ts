import { describe, expect, it } from "vitest";

import {
  DEFAULT_DATASHEET_LIST_QUERY,
  parseDatasheetListQuery,
  serializeDatasheetListQuery,
} from "@/lib/submissions/list-query";

describe("parseDatasheetListQuery", () => {
  it("defaults everything", () => {
    expect(parseDatasheetListQuery({})).toEqual({
      category: null,
      limit: 100,
      q: "",
      sort: "recent",
      status: "all",
    });
  });

  it("parses valid values", () => {
    expect(
      parseDatasheetListQuery({
        category: "Small Outline Packages",
        limit: "200",
        q: "  NE555DR ",
        sort: "pending",
        status: "needs-review",
      }),
    ).toEqual({
      category: "Small Outline Packages",
      limit: 200,
      q: "NE555DR",
      sort: "pending",
      status: "needs-review",
    });
  });

  it("falls back on invalid values and takes the first of repeated params", () => {
    expect(
      parseDatasheetListQuery({
        category: "Not a category",
        limit: "-5",
        q: ["first", "second"],
        sort: "oldest",
        status: ["reviewed", "all"],
      }),
    ).toEqual({
      category: null,
      limit: 100,
      q: "first",
      sort: "recent",
      status: "reviewed",
    });
    expect(parseDatasheetListQuery({ limit: "abc" }).limit).toBe(100);
    expect(parseDatasheetListQuery({ limit: "0" }).limit).toBe(100);
    expect(parseDatasheetListQuery({ limit: "999999" }).limit).toBe(2000);
    expect(parseDatasheetListQuery({ category: "toString" }).category).toBeNull();
  });
});

describe("serializeDatasheetListQuery", () => {
  it("omits defaults", () => {
    expect(serializeDatasheetListQuery(DEFAULT_DATASHEET_LIST_QUERY)).toBe("");
    expect(serializeDatasheetListQuery({})).toBe("");
  });

  it("serializes non-default values in a fixed order", () => {
    expect(
      serializeDatasheetListQuery({
        category: "Quad Flat No-Lead",
        limit: 200,
        q: "ne555",
        sort: "part",
        status: "reviewed",
      }),
    ).toBe("q=ne555&status=reviewed&category=Quad+Flat+No-Lead&sort=part&limit=200");
  });

  it("round-trips through the parser", () => {
    const query = {
      category: "Header, Shrouded" as const,
      limit: 300,
      q: "A & B",
      sort: "newest" as const,
      status: "needs-review" as const,
    };
    const params = Object.fromEntries(new URLSearchParams(serializeDatasheetListQuery(query)));

    expect(parseDatasheetListQuery(params)).toEqual(query);
  });
});
