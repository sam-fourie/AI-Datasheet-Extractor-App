import { describe, expect, it } from "vitest";

import { submissionReviewPayloadSchema } from "@/lib/submissions/schemas";

function payloadWithMeasurement(measurement: Record<string, unknown>) {
  return {
    measurements: [measurement],
    packageSelection: { status: "confirmed" },
    pins: [
      {
        correctedPinName: "Vcc",
        correctedPinNumber: "8",
        correctionNote: null,
        pinIndex: 0,
        status: "corrected",
      },
    ],
    reviewerNotes: "Done by Sam",
  };
}

describe("submissionReviewPayloadSchema", () => {
  it("accepts legacy corrections stored with null optional fields", () => {
    const result = submissionReviewPayloadSchema.safeParse(
      payloadWithMeasurement({
        correctedStatus: null,
        correctedValue: "1.04mm",
        correctionNote: "I think so",
        field: "Pin Length",
        status: "corrected",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.measurements[0].correctedStatus).toBeUndefined();
    expect(result.data?.pins[0].correctionNote).toBeUndefined();
  });

  it("still rejects an unknown correctedStatus value", () => {
    const result = submissionReviewPayloadSchema.safeParse(
      payloadWithMeasurement({
        correctedStatus: "Maybe",
        correctedValue: "1.04mm",
        field: "Pin Length",
        status: "corrected",
      }),
    );

    expect(result.success).toBe(false);
  });

  it("keeps a valid correctedStatus", () => {
    const result = submissionReviewPayloadSchema.safeParse(
      payloadWithMeasurement({
        correctedStatus: "Not found",
        correctedValue: "Not found in datasheet",
        field: "Thermal Pad Width",
        status: "corrected",
      }),
    );

    expect(result.data?.measurements[0].correctedStatus).toBe("Not found");
  });
});
