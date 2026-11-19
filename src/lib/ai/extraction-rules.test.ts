import { describe, expect, it } from "vitest";

import {
  buildRulebookPrompt,
  FIELD_DEFINITIONS,
  getFieldDefinition,
  getTwoTerminalPins,
  isExtractionPromptVersion,
  PACKAGE_FAMILIES,
  type MeasurementFieldName,
} from "@/lib/ai/extraction-rules";
import {
  PACKAGE_CATEGORY_FIELDS,
  packageCategories,
} from "@/lib/package-categories";

describe("rulebook coverage", () => {
  it("puts every category in a package family", () => {
    for (const category of packageCategories) {
      expect(PACKAGE_FAMILIES[category], category).toBeDefined();
    }
  });

  it("has an entry for every field the categories ask for", () => {
    const fields = new Set(packageCategories.flatMap((category) => PACKAGE_CATEGORY_FIELDS[category]));

    for (const field of fields) {
      expect(FIELD_DEFINITIONS[field as MeasurementFieldName], field).toBeDefined();
    }
  });
});

describe("getFieldDefinition", () => {
  it("uses the family's meaning where it differs", () => {
    expect(getFieldDefinition("Pin Width 1", "Resistor Chip")?.text).toMatch(/metal end/);
    expect(getFieldDefinition("Pin Width 1", "Diodes Moulded")?.text).toMatch(/lead length \(L\)/);
    expect(getFieldDefinition("Pin Width 1", "SOT223 (3-Pin)")?.text).toMatch(/never the lead thickness/);
    expect(getFieldDefinition("Pin Width 2", "SOT223 (3-Pin)")?.text).toMatch(/wide tab/);
    expect(getFieldDefinition("Pin Width 2", "SOT23 (5-Pin)")?.text).toMatch(/same as Pin Width 1/);
    expect(getFieldDefinition("Pin Length 1", "Inductor Moulded")?.text).toMatch(/across the body/);
    expect(getFieldDefinition("Body Width", "Capacitor, Polarized Radial Diameter")?.text).toMatch(/Maximum body diameter/);
  });

  it("falls back to the general meaning", () => {
    expect(getFieldDefinition("Height", "Quad Flat No-Lead")?.text).toMatch(/A max/);
    expect(getFieldDefinition("Pin Pitch", "Small Outline Packages")?.text).toMatch(/not the 1\.90 mm across the outer pins/);
  });

  it("has nothing for fields still waiting on a definition", () => {
    expect(getFieldDefinition("Body Offset X", "Header, Shrouded")).toBeNull();
    expect(getFieldDefinition("Not a field", "BGA")).toBeNull();
  });
});

describe("getTwoTerminalPins", () => {
  it("returns the house pins for two-terminal parts", () => {
    expect(getTwoTerminalPins("Diodes Moulded")).toEqual([
      { pinName: "K", pinNumber: "1" },
      { pinName: "A", pinNumber: "2" },
    ]);
    expect(getTwoTerminalPins("Capacitor Chip Polarised")?.map((pin) => pin.pinName)).toEqual(["+", "-"]);
    expect(getTwoTerminalPins("Resistor Chip")?.map((pin) => pin.pinName)).toEqual(["1", "2"]);
  });

  it("returns nothing for packages with more pins", () => {
    expect(getTwoTerminalPins("Quad Flat No-Lead")).toBeNull();
    expect(getTwoTerminalPins("Antennas Chip")).toBeNull();
  });
});

describe("buildRulebookPrompt", () => {
  it("defines each requested field and adds the pin rules", () => {
    const prompt = buildRulebookPrompt({
      packageCategory: "Small Outline Packages",
      partNumber: "NE555DR",
      requestedFields: ["Height", "Pin Pitch", "Thermal Pad Length"],
    });

    expect(prompt).toContain("Part number: NE555DR");
    expect(prompt).toContain("- Height: Maximum overall height");
    expect(prompt).toContain("- Pin Pitch: Centre-to-centre distance");
    expect(prompt).toContain("name it EP");
    expect(prompt).toContain("not printed page labels");
    expect(prompt).not.toContain("two-terminal part");
  });

  it("tells the model the pins of a two-terminal part", () => {
    const prompt = buildRulebookPrompt({
      packageCategory: "Diodes Moulded",
      partNumber: "SS25-LTP",
      requestedFields: ["Pin Span"],
    });

    expect(prompt).toContain("pin 1 named K and pin 2 named A");
    expect(prompt).toContain("- Pin Span: Overall length");
  });

  it("lists a field without a definition by name", () => {
    const prompt = buildRulebookPrompt({
      packageCategory: "Header, Shrouded",
      partNumber: "X",
      requestedFields: ["Body Offset X"],
    });

    expect(prompt).toContain("\n- Body Offset X\n");
  });
});

describe("isExtractionPromptVersion", () => {
  it("accepts known versions only", () => {
    expect(isExtractionPromptVersion("v1")).toBe(true);
    expect(isExtractionPromptVersion("v2")).toBe(true);
    expect(isExtractionPromptVersion("v3")).toBe(false);
    expect(isExtractionPromptVersion(2)).toBe(false);
  });
});
