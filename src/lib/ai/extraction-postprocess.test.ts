import { describe, expect, it } from "vitest";

import type { ExtractionMeasurement, ExtractionPin } from "@/lib/ai";
import {
  applyExtractionRules,
  normalizeActiveLowName,
  normalizeTwoTerminalPinName,
} from "@/lib/ai/extraction-postprocess";

function pin(pinNumber: string, pinName: string): ExtractionPin {
  return { confidence: "high", evidencePages: [3], pinName, pinNumber };
}

function measurement(field: string, value: string | null): ExtractionMeasurement {
  return {
    confidence: "high",
    evidencePages: [5],
    field,
    status: value === null ? "not_found" : "found",
    value,
  };
}

describe("normalizeActiveLowName", () => {
  it.each([
    ["CS̅", "*CS"],
    ["IRQ̅", "*IRQ"],
    ["R̅E̅S̅E̅T̅/FAIL-SAFE", "*RESET/FAIL-SAFE"],
    ["R̅E̅S̅E̅T̅/F̅A̅I̅L̅", "*RESET/*FAIL"],
    ["CS#", "*CS"],
    ["~CS", "*CS"],
    ["/RESET", "*RESET"],
    ["*CS", "*CS"],
    ["I/O", "I/O"],
    ["VDD", "VDD"],
    ["∼", "∼"],
    ["#", "#"],
  ])("turns %s into %s", (input, expected) => {
    expect(normalizeActiveLowName(input)).toBe(expected);
  });
});

describe("normalizeTwoTerminalPinName", () => {
  it.each([
    ["K (cathode)", "diode", "K"],
    ["Cathode", "diode", "K"],
    ["Anode", "diode", "A"],
    ["Positive", "polarisedCapacitor", "+"],
    ["−", "polarisedCapacitor", "-"],
    ["Terminal 2", "nonPolarised", "2"],
    ["1", "nonPolarised", "1"],
  ] as const)("turns %s on a %s into %s", (input, kind, expected) => {
    expect(normalizeTwoTerminalPinName(input, kind)).toBe(expected);
  });
});

describe("applyExtractionRules", () => {
  it("drops inch equivalents from values", () => {
    const outcome = applyExtractionRules({
      measurements: [
        measurement("Pin Length", "0.46 - 0.64 mm (0.018 - 0.025 in)"),
        measurement("Stand Off", null),
      ],
      packageCategory: "SOT23 (3-Pin)",
      pins: [pin("1", "G"), pin("2", "S"), pin("3", "D")],
      selectedPackage: "SOT23 (3-Pin)",
    });

    expect(outcome.measurements.map((row) => row.value)).toEqual(["0.46 - 0.64 mm", null]);
    expect(outcome.notes).toEqual([]);
    expect(outcome.needsReview).toBe(false);
  });

  it("adds the house pins to a two-terminal part the AI left without pins", () => {
    const outcome = applyExtractionRules({
      measurements: [],
      packageCategory: "Diodes Moulded",
      pins: [],
      selectedPackage: "SMC (DO-214AB)",
    });

    expect(outcome.pins).toEqual([
      { confidence: "medium", evidencePages: [], pinName: "K", pinNumber: "1" },
      { confidence: "medium", evidencePages: [], pinName: "A", pinNumber: "2" },
    ]);
    expect(outcome.notes).toEqual([
      "The datasheet doesn't number the terminals, so the pins follow the house rule: 1 is K, 2 is A.",
    ]);
  });

  it("tidies the names of two-terminal pins the AI did return", () => {
    const outcome = applyExtractionRules({
      measurements: [],
      packageCategory: "Diodes Moulded",
      pins: [pin("1", "Cathode"), pin("2", "Anode")],
      selectedPackage: "SMA (DO-214AC)",
    });

    expect(outcome.pins.map((row) => `${row.pinNumber}:${row.pinName}`)).toEqual(["1:K", "2:A"]);
    expect(outcome.notes).toEqual([]);
  });

  it("names the exposed pad EP and numbers it after the last pin", () => {
    const outcome = applyExtractionRules({
      measurements: [],
      packageCategory: "Quad Flat No-Lead",
      pins: [pin("1", "IN"), pin("2", "OUT"), pin("EP", "GND"), pin("3", "CS̅")],
      selectedPackage: "QFN-3",
    });

    expect(outcome.pins.map((row) => `${row.pinNumber}:${row.pinName}`)).toEqual([
      "1:IN",
      "2:OUT",
      "4:EP",
      "3:*CS",
    ]);
  });

  it("keeps a pad's number when it already has one", () => {
    const outcome = applyExtractionRules({
      measurements: [],
      packageCategory: "Small Outline Packages",
      pins: [pin("8", "SW"), pin("9", "EPAD")],
      selectedPackage: "SO-8EP",
    });

    expect(outcome.pins.map((row) => `${row.pinNumber}:${row.pinName}`)).toEqual(["8:SW", "9:EP"]);
  });

  it("asks for a review when the package belongs to another category", () => {
    const outcome = applyExtractionRules({
      measurements: [],
      packageCategory: "SOT223 (3-Pin)",
      pins: [pin("1", "G"), pin("2", "S"), pin("3", "D")],
      selectedPackage: "SOT23 (TO-236AB), 3 leads",
    });

    expect(outcome.needsReview).toBe(true);
    expect(outcome.notes[0]).toMatch(/^Check the category/);
  });

  it("doesn't repeat a category warning the AI already gave", () => {
    const outcome = applyExtractionRules({
      aiNotes: ["The requested SOT223 category conflicts with the datasheet, which specifies SOT23."],
      measurements: [],
      packageCategory: "SOT223 (3-Pin)",
      pins: [pin("1", "G"), pin("2", "S"), pin("3", "D")],
      selectedPackage: "SOT23 (TO-236AB), 3 leads",
    });

    expect(outcome.needsReview).toBe(true);
    expect(outcome.notes).toEqual([]);
  });
});
