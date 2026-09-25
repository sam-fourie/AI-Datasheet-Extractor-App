import { describe, expect, it } from "vitest";

import {
  PACKAGE_CATEGORY_GROUPS,
  PACKAGE_CATEGORY_KEYWORDS,
  packageCategories,
  type PackageCategory,
} from "@/lib/package-categories";

describe("PACKAGE_CATEGORY_GROUPS", () => {
  it("has the 8 groups in order", () => {
    expect(PACKAGE_CATEGORY_GROUPS.map((group) => group.label)).toEqual([
      "IC packages",
      "Transistor packages",
      "Diodes & LEDs",
      "Capacitors",
      "Resistors & protection",
      "Inductors & ferrites",
      "Connectors & sockets",
      "Other",
    ]);
  });

  it("lists every one of the 56 categories exactly once", () => {
    const grouped = PACKAGE_CATEGORY_GROUPS.flatMap((group) => group.categories);

    expect(packageCategories).toHaveLength(56);
    expect(grouped).toHaveLength(56);
    expect(new Set(grouped).size).toBe(56);
    expect([...grouped].sort()).toEqual([...packageCategories].sort());
  });

  it("has unique group ids", () => {
    const ids = PACKAGE_CATEGORY_GROUPS.map((group) => group.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("PACKAGE_CATEGORY_KEYWORDS", () => {
  function categoriesFor(query: string) {
    const needle = query.toLowerCase();

    return (Object.entries(PACKAGE_CATEGORY_KEYWORDS) as Array<[PackageCategory, string[]]>)
      .filter(([, keywords]) => keywords.some((keyword) => keyword.toLowerCase() === needle))
      .map(([category]) => category);
  }

  it("maps common abbreviations to categories", () => {
    expect(categoriesFor("qfn")).toEqual(["Quad Flat No-Lead"]);
    expect(categoriesFor("soic")).toEqual(["Small Outline Packages"]);
    expect(categoriesFor("dfn")).toEqual(["Small Outline No-lead"]);
    expect(categoriesFor("lqfp")).toEqual(["Quad Flat Packages"]);
    expect(categoriesFor("to-92")).toEqual(["Transistor Outline, Vertical"]);
    expect(categoriesFor("sod")).toEqual(["Small Outline Diode"]);
    expect(categoriesFor("pdip")).toEqual(["Dual-In-Line Packages"]);
    expect(categoriesFor("cdip")).toEqual(["Ceramic Dual-In-Line Packages"]);
    expect(categoriesFor("plcc")).toEqual(["Plastic Leaded Chip Carrier"]);
    expect(categoriesFor("bga")).toEqual(["BGA"]);
    expect(categoriesFor("sot")).toHaveLength(7);
  });

  it("only uses real categories", () => {
    for (const category of Object.keys(PACKAGE_CATEGORY_KEYWORDS)) {
      expect(packageCategories).toContain(category);
    }
  });
});
