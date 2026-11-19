import { describe, expect, it } from "vitest";

import type { MeasurementFieldRow, PinRow } from "@/lib/package-categories";
import {
  compareMeasurementValues,
  comparePinNames,
  evaluateExtraction,
  sumTallies,
} from "@/lib/submissions/extraction-eval";
import type { ExtractionSnapshot, SubmissionHumanReview } from "@/lib/submissions/types";

const found = (value: string) => ({ status: "Extracted" as const, value });
const notFound = { status: "Not found" as const, value: "Not found in datasheet" };

describe("compareMeasurementValues", () => {
  it.each([
    ["Pin Length", "0.30 mm - 0.50 mm", "0.30–0.50 mm"],
    ["Pin Length", "1.0 ± 0.2", "0.8–1.2 mm"],
    ["Pin Length", "0.46 - 0.64 mm (0.018 - 0.025 in)", "0.46–0.64 mm"],
    ["Pin Pitch", "1.27 mm", "1.27 mm BSC"],
    ["Height", "1.00 mm", "0.95 mm (0.90–1.00 mm)"],
    ["Height", "0.55 ± 0.10 mm", "0.65 mm"],
    ["Height", "2.00–2.62 mm", "2.62 mm max"],
  ])("treats %s %s and %s as the same", (field, expected, actual) => {
    expect(compareMeasurementValues(field, found(expected), found(actual))).toBe("right");
  });

  it.each([
    ["Body Width", "3.80–4.00 mm", "3.81 mm BSC"],
    ["Stand Off", "0.02 mm - 0.05 mm", "0.05 mm max"],
  ])("gives %s %s against %s partial credit", (field, expected, actual) => {
    expect(compareMeasurementValues(field, found(expected), found(actual))).toBe("partial");
  });

  it.each([
    ["Pin Pitch", "0.95", "1.9 mm nominal"],
    ["Pin Length", "0.40–1.27 mm", "0.25–0.50 mm"],
    ["Height", "1.6 mm", "1.4 mm"],
    ["Pin Width 1", "0.76–1.52 mm", "2.75–3.25 mm"],
  ])("marks %s %s against %s wrong", (field, expected, actual) => {
    expect(compareMeasurementValues(field, found(expected), found(actual))).toBe("wrong");
  });

  it("compares Not found exactly", () => {
    expect(compareMeasurementValues("Stand Off", notFound, notFound)).toBe("right");
    expect(compareMeasurementValues("Stand Off", notFound, found("0.05 mm"))).toBe("wrong");
    expect(compareMeasurementValues("Stand Off", found("0.05 mm"), notFound)).toBe("wrong");
  });
});

describe("comparePinNames", () => {
  it("separates formatting from a different name", () => {
    expect(comparePinNames("*CS", "*CS")).toBe("right");
    expect(comparePinNames("Vcc", "VCC")).toBe("right");
    expect(comparePinNames("*CS", "CS")).toBe("partial");
    expect(comparePinNames("A_1", "A1")).toBe("partial");
    expect(comparePinNames("G (gate)", "G")).toBe("partial");
    expect(comparePinNames("K (cathode)", "K")).toBe("partial");
    expect(comparePinNames("A", "A_1")).toBe("partial");
    expect(comparePinNames("Cathode", "K")).toBe("partial");
    expect(comparePinNames("Anode", "K")).toBe("wrong");
    expect(comparePinNames("∼", "~")).toBe("right");
    expect(comparePinNames("∼", "~_1")).toBe("partial");
    expect(comparePinNames("+", "-")).toBe("wrong");
    expect(comparePinNames("-", "−")).toBe("right");
    expect(comparePinNames("K", "C")).toBe("wrong");
    expect(comparePinNames("NC", "VDD")).toBe("wrong");
  });
});

function row(field: string, value: string, status: MeasurementFieldRow["status"] = "Extracted"): MeasurementFieldRow {
  return { confidence: "high", evidencePages: [1], field, status, value };
}

function pin(pinNumber: string, pinName: string): PinRow {
  return { confidence: "high", evidencePages: [1], pinName, pinNumber };
}

function extraction(fields: MeasurementFieldRow[], pinRows: PinRow[]): ExtractionSnapshot {
  return {
    fields,
    packageSelection: { alternatives: [], confidence: "high", selectedPackage: "SOT23" },
    pinRows,
    providerMeta: { model: "gpt-5.6-terra", provider: "openai" },
    review: { needsReview: false, notes: [] },
  };
}

describe("evaluateExtraction", () => {
  const baseline = {
    extraction: extraction(
      [row("Height", "1.10 mm max"), row("Pin Pitch", "1.9 mm"), row("Stand Off", "0.1 mm")],
      [pin("1", "G"), pin("2", "S"), pin("3, 4", "D")],
    ),
    review: {
      measurements: [
        { field: "Height", status: "confirmed" },
        { correctedValue: "0.95", field: "Pin Pitch", status: "corrected" },
        { field: "Stand Off", status: "pending" },
      ],
      packageSelection: { status: "confirmed" },
      pins: [
        { pinIndex: 0, status: "confirmed" },
        { correctedPinName: "*S", pinIndex: 1, status: "corrected" },
        { pinIndex: 2, status: "confirmed" },
      ],
      reviewerNotes: "",
    } satisfies SubmissionHumanReview,
  };

  it("scores reviewed rows only, against the reviewer's values", () => {
    const result = evaluateExtraction(
      baseline,
      extraction(
        [row("Height", "0.90–1.10 mm"), row("Pin Pitch", "0.95 mm BSC"), row("Stand Off", "9 mm")],
        [pin("1", "G"), pin("2", "S"), pin("3", "D")],
      ),
    );

    expect(result.measurements).toEqual({ missing: 0, partial: 0, right: 2, total: 2, wrong: 0 });
    // Pin 2 lost its * and pin 4 is missing from the candidate.
    expect(result.pins).toEqual({ missing: 1, partial: 1, right: 2, total: 4, wrong: 0 });
    expect(result.rows.find((entry) => entry.label === "Pin 4")).toMatchObject({
      actual: "Missing",
      expected: "D",
      outcome: "missing",
    });
  });

  it("matches the exposed pad pad to pad", () => {
    const withPad = {
      extraction: extraction([], [pin("1", "IN"), pin("EXP_PAD", "GND")]),
      review: {
        measurements: [],
        packageSelection: { status: "confirmed" },
        pins: [
          { pinIndex: 0, status: "confirmed" },
          { pinIndex: 1, status: "confirmed" },
        ],
        reviewerNotes: "",
      } satisfies SubmissionHumanReview,
    };
    const result = evaluateExtraction(withPad, extraction([], [pin("1", "IN"), pin("2", "EP")]));

    expect(result.rows.find((entry) => entry.label === "Exposed pad")).toMatchObject({
      actual: "2: EP",
      expected: "EXP_PAD: GND",
      outcome: "partial",
    });
    expect(evaluateExtraction(withPad, extraction([], [pin("1", "IN")])).pins.missing).toBe(1);
  });

  it("adds tallies", () => {
    expect(
      sumTallies([
        { missing: 1, partial: 0, right: 2, total: 3, wrong: 0 },
        { missing: 0, partial: 1, right: 1, total: 3, wrong: 1 },
      ]),
    ).toEqual({ missing: 1, partial: 1, right: 3, total: 6, wrong: 1 });
  });
});
