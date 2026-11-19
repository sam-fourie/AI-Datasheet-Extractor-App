import { describe, expect, it } from "vitest";

import {
  isSameMillimetres,
  parseCount,
  parseMeasurementInterval,
  stripInchEquivalents,
} from "@/lib/ai/measurement-values";

describe("stripInchEquivalents", () => {
  it.each([
    ["0.46 - 0.64 mm (0.018 - 0.025 in)", "0.46 - 0.64 mm"],
    ["0.5 ± 0.3 mm (0.020 ± 0.012 in)", "0.5 ± 0.3 mm"],
    ["0.10 mm min (0.0039 in)", "0.10 mm min"],
    ["0.25 mm min (0.010 in min)", "0.25 mm min"],
    ["0.95 mm (0.037 in) BSC", "0.95 mm BSC"],
    ["4.000 mm [0.157 in]", "4.000 mm"],
    ["1.103 mm [0.043 in] typ", "1.103 mm typ"],
    [
      "1.150 ± 0.254 mm (0.045 ± 0.01 in), dimension C",
      "1.150 ± 0.254 mm, dimension C",
    ],
    ["0.118 ± 0.008 in [3.0 ± 0.2 mm]", "3.0 ± 0.2 mm"],
    ["0.047 in max. [1.2 mm max.]", "1.2 mm max."],
  ])("tidies %s", (input, expected) => {
    expect(stripInchEquivalents(input)).toBe(expected);
  });

  it.each([
    "0.30–0.50 mm",
    "6.3 ±0.5 mm (φD)",
    "0.25 ± 0.15 mm (T2)",
    "1.60 mm max (min 1.40)",
    "Not found in datasheet",
    "0.5 in",
  ])("leaves %s alone", (input) => {
    expect(stripInchEquivalents(input)).toBe(input);
  });
});

describe("parseMeasurementInterval", () => {
  it.each([
    ["0.30–0.50 mm", 0.3, 0.5],
    ["0.30 mm - 0.50 mm", 0.3, 0.5],
    ["0.000 to 0.050 mm", 0, 0.05],
    ["5.5 -  5.7 mm", 5.5, 5.7],
    ["1.0 ± 0.2", 0.8, 1.2],
    ["10 mm (±1.0 max)", 9, 11],
    ["0.60 +0.15/-0.10 mm", 0.5, 0.75],
    ["0.65 BSC mm", 0.65, 0.65],
    ["(2.2) mm", 2.2, 2.2],
    ["0.95 mm (0.90–1.00 mm)", 0.9, 1],
    ["1.90–2.10 mm (2.00 mm nom)", 1.9, 2.1],
    ["0.46 - 0.64 mm (0.018 - 0.025 in)", 0.46, 0.64],
    ["0.118 ± 0.008 in [3.0 ± 0.2 mm]", 2.8, 3.2],
    ["6.3 ±0.5 mm (φD)", 5.8, 6.8],
    ["2.200 ± 0.254", 1.946, 2.454],
    ["0.5 in", 12.7, 12.7],
    ["6.80 / 7.00 / 7.20 mm (min/typ/max)", 6.8, 7.2],
    ["D1 = 6.80 / 7.00 / 7.20 mm", 6.8, 7.2],
    ["A1 = 0.05 / 0.15 mm", 0.05, 0.15],
    ["0.05 min / 0.15 max mm", 0.05, 0.15],
    ["0.05 mm min, 0.15 mm max", 0.05, 0.15],
    ["0.35 ± 0.15 mm (T1)", 0.2, 0.5],
    ["5.90–6.10 mm (E1)", 5.9, 6.1],
  ])("reads %s", (input, min, max) => {
    const interval = parseMeasurementInterval(input);

    expect(interval?.min).toBeCloseTo(min, 6);
    expect(interval?.max).toBeCloseTo(max, 6);
  });

  it.each([
    ["1.60 mm max", null, 1.6],
    ["1.10 MAX mm", null, 1.1],
    ["0.047 in max. [1.2 mm max.]", null, 1.2],
    ["5.4 mm maximum", null, 5.4],
    ["D: 0.10 mm min (0.0039 in)", 0.1, null],
    ["0.6 mm min.", 0.6, null],
    ["0.1 mm max (A1)", null, 0.1],
  ])("reads the one-sided %s", (input, min, max) => {
    expect(parseMeasurementInterval(input)).toEqual({ max, min });
  });

  it.each([
    "Not found in datasheet",
    "0-8 Degrees",
    "h: 0.40–1.27 mm; L: 0.25–0.50 mm",
    "0.95 mm BSC (B); 1.90 mm BSC (E) also shown between the two lower pins",
    "",
    "see drawing",
  ])("gives up on %s", (input) => {
    expect(parseMeasurementInterval(input)).toBeNull();
  });
});

describe("parseCount", () => {
  it.each([
    ["12", 12],
    ["15 pins per side", 15],
    ["6 each side", 6],
    ["4 / 4", 4],
  ])("reads %s", (input, expected) => {
    expect(parseCount(input)).toBe(expected);
  });

  it("ignores missing values", () => {
    expect(parseCount("Not found in datasheet")).toBeNull();
    expect(parseCount(undefined)).toBeNull();
  });
});

describe("isSameMillimetres", () => {
  it("allows rounding but not a different figure", () => {
    expect(isSameMillimetres(0.254, 0.25)).toBe(true);
    expect(isSameMillimetres(22, 22.1)).toBe(true);
    expect(isSameMillimetres(0.95, 1.9)).toBe(false);
    expect(isSameMillimetres(1.4, 1.6)).toBe(false);
  });
});
