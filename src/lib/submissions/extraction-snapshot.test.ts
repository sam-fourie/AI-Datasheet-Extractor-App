import { describe, expect, it } from "vitest";

import { toMeasurementFieldRow, toPinRow } from "@/lib/submissions/extraction-snapshot";

describe("evidence document", () => {
  it("records rows whose evidence is in the package drawing", () => {
    expect(
      toMeasurementFieldRow({
        confidence: "high",
        evidenceDocument: "drawing",
        evidencePages: [2],
        field: "Height",
        status: "found",
        value: "0.80 mm",
      }),
    ).toMatchObject({ evidenceDocument: "drawing", evidencePages: [2] });
    expect(
      toPinRow({ confidence: "high", evidenceDocument: "drawing", evidencePages: [1], pinName: "EP", pinNumber: "49" }),
    ).toMatchObject({ evidenceDocument: "drawing" });
  });

  it("leaves datasheet rows as they were", () => {
    expect(
      toPinRow({ confidence: "high", evidencePages: [3], pinName: "VDD", pinNumber: "1" }),
    ).not.toHaveProperty("evidenceDocument");
  });
});
