import { describe, expect, it } from "vitest";

import {
  describeCategoryMismatch,
  mentionsSeparateDrawing,
  detectPackageCodeFamilies,
  isExposedPadPin,
  listPinNumbers,
  mentionsExposedPad,
  readPackagePinCount,
} from "@/lib/ai/package-text";

describe("describeCategoryMismatch", () => {
  it("flags a package that belongs to another category", () => {
    expect(describeCategoryMismatch("SOT223 (3-Pin)", "SOT23 (TO-236AB), 3 leads")).toBe(
      "Check the category: the datasheet's package looks like a SOT-23, but the category is SOT223 (3-Pin).",
    );
    expect(
      describeCategoryMismatch("Quad Flat Packages", "8L SOIC-CU (150mil), package option S8+4C"),
    ).toContain("a small-outline package");
  });

  it.each([
    ["SOT223 (3-Pin)", "SOT-223 (TO-261), Case 318E-04, Style 3"],
    ["SOT23 (5-Pin)", "DBV (SOT-23), 5-pin"],
    ["Small Outline Packages", "SOT-23-THIN (DYY), 14-pin"],
    ["Small Outline Packages", "SO-8EP"],
    ["Small Outline Packages", "TBL"],
    ["Quad Flat No-Lead", "50-FC2QFN (F5067F+1F)"],
    ["Quad Flat No-Lead", "CP-24-17, 24-Lead LFCSP (QFN), 4 mm × 4 mm"],
    ["Small Outline No-lead", "DFN2*2-8"],
    ["Small Outline Diode Flat Lead", "SOD-123FL"],
    ["Diodes Moulded", "SMC (DO-214AB)"],
    ["Resistor Chip", "SOIC-8"],
  ])("accepts %s with %s", (category, packageText) => {
    expect(describeCategoryMismatch(category as never, packageText)).toBeNull();
  });

  it("does not read SOT-223 as SOT-23", () => {
    expect(detectPackageCodeFamilies("SOT-223")).toEqual(["sot223"]);
    expect(detectPackageCodeFamilies("SOT223")).toEqual(["sot223"]);
  });
});

describe("readPackagePinCount", () => {
  it.each([
    ["48-Pin TQFN 6mm x 6mm", 48],
    ["SOT23 (TO-236AB), 3 leads", 3],
    ["QFN-16 3x3x1mm package with wettable flanks", 16],
    ["D (SOIC, 8)", 8],
    ["50-FC2QFN (F5067F+1F)", 50],
    ["8L SOIC-CU (150mil), package option S8+4C", 8],
    ["SSOP16L", 16],
    ["SO-8EP", 8],
    ["SMD-16", 16],
    ["FCBGA1723+HS", 1723],
    ["DG983-4, 4 x 4 mm 20-lead QFN-style package", 20],
    ["DFN2*2-8", 8],
    ["LQFP144", 144],
  ])("reads %s", (packageText, expected) => {
    expect(readPackagePinCount(packageText)).toBe(expected);
  });

  it.each(["SOT-223 (TO-261), Case 318E-04, Style 3", "WSON (DEE)", "TBL", "Radial, φ8 × 20 mm"])(
    "finds no count in %s",
    (packageText) => {
      expect(readPackagePinCount(packageText)).toBeNull();
    },
  );
});

describe("exposed pads", () => {
  it("spots the pad in a package description", () => {
    expect(mentionsExposedPad("24-Lead LFCSP with exposed pad")).toBe(true);
    expect(mentionsExposedPad("SO-8EP")).toBe(true);
    expect(mentionsExposedPad("20-lead QFN-style package with exposed paddle")).toBe(true);
    expect(mentionsExposedPad("QFN-16 3x3x1mm package with wettable flanks")).toBe(false);
  });

  it.each([
    ["-", "Thermal Pad"],
    ["EP", "VDD"],
    ["EXP_PAD", "GND"],
    ["Paddle", "GND"],
    ["9", "EPAD"],
    ["17", "EP"],
  ])("recognises %s:%s", (pinNumber, pinName) => {
    expect(isExposedPadPin({ pinName, pinNumber })).toBe(true);
  });

  it.each([
    ["4", "TAB"],
    ["2", "DRAIN"],
    ["5", "EN"],
    ["12", "PADDR"],
  ])("leaves %s:%s alone", (pinNumber, pinName) => {
    expect(isExposedPadPin({ pinName, pinNumber })).toBe(false);
  });
});

describe("listPinNumbers", () => {
  it("expands lists and ranges", () => {
    expect(listPinNumbers("15, 16")).toEqual(["15", "16"]);
    expect(listPinNumbers("1-2, 4-6, 23")).toEqual(["1", "2", "4", "5", "6", "23"]);
    expect(listPinNumbers("13–16")).toEqual(["13", "14", "15", "16"]);
  });

  it("keeps single pins and ball names", () => {
    expect(listPinNumbers("7")).toEqual(["7"]);
    expect(listPinNumbers("A1")).toEqual(["A1"]);
    expect(listPinNumbers("EP")).toEqual(["EP"]);
  });
});

describe("mentionsSeparateDrawing", () => {
  it.each([
    "The package outline drawing (outline 21-100765) is referenced but is not included in the supplied PDF.",
    "The datasheet directs detailed package dimensions to external drawing 98ASS23177W.",
    "The PDF contains no package mechanical dimensions.",
  ])("spots %s", (note) => {
    expect(mentionsSeparateDrawing([note])).toBe(true);
  });

  it.each([
    "Package drawing D0008A on page 30 was used for all body dimensions.",
    "The datasheet states package dimensions as 5mm × 7mm.",
    "Pins per side were counted from the PL84 package drawing.",
  ])("leaves %s alone", (note) => {
    expect(mentionsSeparateDrawing([note])).toBe(false);
  });
});
