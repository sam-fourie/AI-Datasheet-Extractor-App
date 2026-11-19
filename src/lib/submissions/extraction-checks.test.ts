import { describe, expect, it } from "vitest";

import type { MeasurementFieldRow, PinRow } from "@/lib/package-categories";
import { checkExtraction, evaluatePinCount } from "@/lib/submissions/extraction-checks";
import { classifyRowAttention } from "@/lib/submissions/review";
import type { ExtractionSnapshot } from "@/lib/submissions/types";

function field(name: string, value: string, status: MeasurementFieldRow["status"] = "Extracted"): MeasurementFieldRow {
  return { confidence: "high", evidencePages: [4], field: name, status, value };
}

function pins(...entries: Array<[string, string]>): PinRow[] {
  return entries.map(([pinNumber, pinName]) => ({
    confidence: "high",
    evidencePages: [2],
    pinName,
    pinNumber,
  }));
}

function numberedPins(count: number) {
  return pins(...Array.from({ length: count }, (_, index): [string, string] => [String(index + 1), `P${index + 1}`]));
}

function snapshot(overrides: Partial<ExtractionSnapshot> = {}): ExtractionSnapshot {
  return {
    fields: [],
    packageSelection: { alternatives: [], confidence: "high", selectedPackage: "SOIC-8" },
    pinRows: numberedPins(8),
    providerMeta: { model: "gpt-5.6-terra", provider: "openai" },
    review: { needsReview: false, notes: [] },
    ...overrides,
  };
}

describe("grouped pins", () => {
  it("flags rows that list several pins", () => {
    const extraction = snapshot({
      packageSelection: { alternatives: [], confidence: "high", selectedPackage: "24-pin QFN" },
      pinRows: pins(["1-2, 4-11, 13-15, 17-19, 23", "NC"], ["3", "RFIN"], ["20, 21", "VD2"]),
    });

    expect([...checkExtraction(extraction).groupedPinIndexes]).toEqual([0, 2]);
    expect(classifyRowAttention(extraction, { kind: "pin", pinIndex: 2 })).toContain("groupedPins");
    expect(classifyRowAttention(extraction, { kind: "pin", pinIndex: 1 })).not.toContain("groupedPins");
  });
});

describe("pin count", () => {
  it("accepts a full list, with or without a named pad", () => {
    expect(checkExtraction(snapshot()).pinCountMismatch).toBeNull();
    expect(
      checkExtraction(
        snapshot({
          packageSelection: { alternatives: [], confidence: "high", selectedPackage: "SO-8EP" },
          pinRows: [...numberedPins(8), ...pins(["9", "EP"])],
        }),
      ).pinCountMismatch,
    ).toBeNull();
  });

  it("allows one extra pin when the pad is listed under its net", () => {
    expect(
      checkExtraction(
        snapshot({
          packageSelection: { alternatives: [], confidence: "high", selectedPackage: "24-pin QFN" },
          pinRows: [...numberedPins(24), ...pins(["25", "GND"])],
        }),
      ).pinCountMismatch,
    ).toBeNull();
  });

  it("flags a short list on the package row", () => {
    const extraction = snapshot({
      packageSelection: { alternatives: [], confidence: "high", selectedPackage: "FCBGA1723+HS" },
      pinRows: numberedPins(63),
    });

    expect(checkExtraction(extraction).pinCountMismatch).toMatchObject({ expected: 1723, listed: 63 });
    expect(classifyRowAttention(extraction, { kind: "package" })).toContain("pinCountMismatch");
  });

  it("flags a missing exposed pad", () => {
    const extraction = snapshot({
      packageSelection: {
        alternatives: [],
        confidence: "high",
        selectedPackage: "24-Lead LFCSP with exposed pad",
      },
      pinRows: numberedPins(24),
    });

    expect(checkExtraction(extraction).pinCountMismatch).toMatchObject({ exposedPad: true, padListed: false });
  });

  it("counts grouped rows by their pins", () => {
    expect(
      evaluatePinCount({
        packageSelection: { alternatives: [], confidence: "high", selectedPackage: "48-Pin QFN" },
        pinRows: [...numberedPins(44), ...pins(["45, 46", "OUT1"], ["47-48", "OUT2"])],
      }),
    ).toMatchObject({ expected: 48, listed: 48 });
  });

  it("skips packages without a stated count", () => {
    expect(
      checkExtraction(
        snapshot({
          packageSelection: { alternatives: [], confidence: "high", selectedPackage: "SOT-223 (TO-261)" },
          pinRows: numberedPins(4),
        }),
      ).pinCountMismatch,
    ).toBeNull();
  });
});

describe("inconsistent measurements", () => {
  it("flags measurements that can't all be true", () => {
    const extraction = snapshot({
      fields: [
        field("Height", "1.00 mm"),
        field("Stand Off", "1.20–1.40 mm"),
        field("Pin Pitch", "0.50 mm"),
        field("Pin Width", "0.18–0.30 mm"),
        field("Body Width", "6.0–6.2 mm"),
        field("Pin Span", "3.80–4.00 mm"),
      ],
    });

    expect([...checkExtraction(extraction).inconsistentFields].sort()).toEqual([
      "body width",
      "height",
      "pin span",
      "stand off",
    ]);
    expect(classifyRowAttention(extraction, { field: "Height", kind: "measurement" })[0]).toBe(
      "inconsistentMeasurement",
    );
    expect(classifyRowAttention(extraction, { field: "Pin Width", kind: "measurement" })).toEqual([]);
  });

  it("ignores values it can't read and fields the AI didn't find", () => {
    const extraction = snapshot({
      fields: [
        field("Height", "Not found in datasheet", "Not found"),
        field("Stand Off", "0.05 mm max"),
        field("Pin Pitch", "0-8 Degrees"),
        field("Pin Width", "0.31–0.51 mm"),
      ],
    });

    expect(checkExtraction(extraction).inconsistentFields.size).toBe(0);
  });

  it("checks a moulded part's terminal against its overall length", () => {
    const extraction = snapshot({
      fields: [
        field("Pin Length 1", "1.0 ± 0.2 mm"),
        field("Pin Span", "0.5 ± 0.3 mm"),
        field("Pin Width 1", "0.9–1.1 mm"),
      ],
      pinRows: [],
    });

    expect([...checkExtraction(extraction).inconsistentFields].sort()).toEqual(["pin span", "pin width 1"]);
  });

  it("checks the pins per side against the package", () => {
    const extraction = snapshot({
      fields: [field("Left/Right Pins", "12 per side"), field("Top/Bottom Pins", "10 per side")],
      packageSelection: { alternatives: [], confidence: "high", selectedPackage: "48-Pin TQFN" },
      pinRows: numberedPins(48),
    });

    expect([...checkExtraction(extraction).inconsistentFields].sort()).toEqual([
      "left/right pins",
      "top/bottom pins",
    ]);
  });
});
