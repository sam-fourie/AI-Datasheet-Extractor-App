import { describe, expect, it } from "vitest";

import {
  measurementRowKey as agreementMeasurementRowKey,
  PACKAGE_ROW_KEY as AGREEMENT_PACKAGE_ROW_KEY,
  pinRowKey as agreementPinRowKey,
} from "@/lib/submissions/agreement";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import {
  applyCorrection,
  buildSubmissionResolvedView,
  bulkConfirm,
  classifyRowAttention,
  countChangedDecisions,
  countDecisionsForRows,
  countSectionDecisions,
  createDefaultSubmissionReview,
  describeAttentionReason,
  findNextPendingRow,
  getCorrectionDefaults,
  getInitialReviewMode,
  getRowDecision,
  isBulkConfirmEligible,
  isCorrectionUnchanged,
  isReviewDraftDirty,
  listReviewRowRefs,
  normalizeSubmissionReview,
  planBulkConfirm,
  REVIEWER_NOTES_MAX_LENGTH,
  rowKeyOf,
  runHintDisagrees,
  setDecision,
  toggleConfirmed,
  validateCorrection,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import { submissionReviewPayloadSchema } from "@/lib/submissions/schemas";
import type {
  ExtractionSnapshot,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

function makeExtraction(overrides: Partial<ExtractionSnapshot> = {}): ExtractionSnapshot {
  return {
    fields: [
      {
        confidence: "high",
        evidencePages: [3],
        field: "Body Length",
        status: "Extracted",
        value: "4.90 mm",
      },
      {
        confidence: "medium",
        evidencePages: [3, 30],
        field: "Body Width",
        status: "Extracted",
        value: "3.91 mm",
      },
      {
        confidence: "high",
        evidencePages: [30],
        field: "Height",
        status: "Needs review",
        value: "1.75 mm",
      },
      {
        confidence: "low",
        evidencePages: [],
        field: "Stand Off",
        status: "Not found",
        value: NOT_FOUND_VALUE,
      },
    ],
    packageSelection: {
      alternatives: ["PS (SO, 8)"],
      confidence: "high",
      selectedPackage: "D (SOIC, 8)",
    },
    pinRows: [
      { confidence: "high", evidencePages: [3], pinName: "GND", pinNumber: "1" },
      { confidence: "high", evidencePages: [3], pinName: "TRIG", pinNumber: "2" },
      { confidence: "high", pinName: "OUT", pinNumber: "3" },
    ],
    providerMeta: { model: "gpt-5.4", provider: "openai", reasoningEffort: "high" },
    review: { needsReview: false, notes: [] },
    ...overrides,
  };
}

const bodyLength: ReviewRowRef = { field: "Body Length", kind: "measurement" };
const bodyWidth: ReviewRowRef = { field: "Body Width", kind: "measurement" };
const height: ReviewRowRef = { field: "Height", kind: "measurement" };
const standOff: ReviewRowRef = { field: "Stand Off", kind: "measurement" };
const packageRef: ReviewRowRef = { kind: "package" };
const pin0: ReviewRowRef = { kind: "pin", pinIndex: 0 };
const pin1: ReviewRowRef = { kind: "pin", pinIndex: 1 };
const pin2: ReviewRowRef = { kind: "pin", pinIndex: 2 };

function freshReview(extraction = makeExtraction()): SubmissionHumanReview {
  return createDefaultSubmissionReview(extraction);
}

describe("row keys", () => {
  it("matches the agreement row keys", () => {
    expect(rowKeyOf(packageRef)).toBe(AGREEMENT_PACKAGE_ROW_KEY);
    expect(rowKeyOf(bodyLength)).toBe(agreementMeasurementRowKey("Body Length"));
    expect(rowKeyOf(bodyLength)).toBe("measurement:body length");
    expect(rowKeyOf(pin2)).toBe(agreementPinRowKey(2));
    expect(rowKeyOf(pin2)).toBe("pin:2");
  });

  it("lists rows in display order", () => {
    const refs = listReviewRowRefs(makeExtraction());

    expect(refs.map(rowKeyOf)).toEqual([
      "package",
      "measurement:body length",
      "measurement:body width",
      "measurement:height",
      "measurement:stand off",
      "pin:0",
      "pin:1",
      "pin:2",
    ]);
  });
});

describe("getInitialReviewMode", () => {
  it("opens pending baselines in edit mode and everything else in read mode", () => {
    expect(getInitialReviewMode({ reviewStatus: "pending" })).toBe("edit");
    expect(getInitialReviewMode({ reviewStatus: "reviewed" })).toBe("read");
    expect(
      getInitialReviewMode({
        comparison: { agreement: null, baseline: null, baselineSubmissionId: "a" },
        reviewStatus: "pending",
      }),
    ).toBe("read");
  });
});

describe("setDecision", () => {
  it("toggles confirm on and back off", () => {
    const review = freshReview();
    const confirmed = toggleConfirmed(review, bodyLength);

    expect(getRowDecision(confirmed, bodyLength)).toBe("confirmed");
    expect(getRowDecision(toggleConfirmed(confirmed, bodyLength), bodyLength)).toBe("pending");
    expect(getRowDecision(setDecision(confirmed, bodyLength, "pending"), bodyLength)).toBe(
      "pending",
    );
  });

  it("does not mutate the input and only touches the target row", () => {
    const review = freshReview();
    const snapshot = structuredClone(review);
    const next = setDecision(review, pin1, "confirmed");

    expect(review).toEqual(snapshot);
    expect(next.pins[0]).toBe(review.pins[0]);
    expect(next.measurements).toBe(review.measurements);
    expect(next.pins[1]).toEqual({ pinIndex: 1, status: "confirmed" });
  });

  it("replaces a correction when confirming a corrected row", () => {
    const extraction = makeExtraction();
    const corrected = applyCorrection(extraction, freshReview(extraction), bodyLength, {
      kind: "measurement",
      note: "Drawing on p. 30",
      notInDatasheet: false,
      value: "5.00 mm",
    });
    const confirmed = setDecision(corrected, bodyLength, "confirmed");

    expect(confirmed.measurements[0]).toEqual({ field: "Body Length", status: "confirmed" });
  });

  it("sets the package decision", () => {
    expect(setDecision(freshReview(), packageRef, "confirmed").packageSelection).toEqual({
      status: "confirmed",
    });
  });
});

describe("corrections", () => {
  const extraction = makeExtraction();

  it("prefills from the AI value, or empty for Not found", () => {
    const review = freshReview(extraction);

    expect(getCorrectionDefaults(extraction, review, bodyLength)).toEqual({
      kind: "measurement",
      note: "",
      notInDatasheet: false,
      value: "4.90 mm",
    });
    expect(getCorrectionDefaults(extraction, review, standOff).value).toBe("");
    expect(getCorrectionDefaults(extraction, review, pin1)).toEqual({
      kind: "pin",
      note: "",
      pinName: "TRIG",
      pinNumber: "2",
    });
    expect(getCorrectionDefaults(extraction, review, packageRef)).toEqual({
      kind: "package",
      note: "",
      selectedPackage: "D (SOIC, 8)",
    });
  });

  it("prefills from an existing correction", () => {
    const review = applyCorrection(extraction, freshReview(extraction), bodyLength, {
      kind: "measurement",
      note: "note",
      notInDatasheet: false,
      value: "5.00 mm",
    });

    expect(getCorrectionDefaults(extraction, review, bodyLength)).toEqual({
      kind: "measurement",
      note: "note",
      notInDatasheet: false,
      value: "5.00 mm",
    });

    const notFound = applyCorrection(extraction, review, height, {
      kind: "measurement",
      note: "",
      notInDatasheet: true,
      value: "",
    });

    expect(getCorrectionDefaults(extraction, notFound, height).notInDatasheet).toBe(true);
  });

  it("validates required values", () => {
    expect(
      validateCorrection(bodyLength, {
        kind: "measurement",
        note: "",
        notInDatasheet: false,
        value: "  ",
      }),
    ).toBe("Enter the correct value");
    expect(
      validateCorrection(bodyLength, {
        kind: "measurement",
        note: "",
        notInDatasheet: true,
        value: "",
      }),
    ).toBeNull();
    expect(
      validateCorrection(pin0, { kind: "pin", note: "", pinName: "GND", pinNumber: "" }),
    ).toBe("Enter the pin number and name");
    expect(
      validateCorrection(pin0, { kind: "pin", note: "", pinName: "GND", pinNumber: "1" }),
    ).toBeNull();
    expect(
      validateCorrection(packageRef, { kind: "package", note: "", selectedPackage: "" }),
    ).toBe("Enter the correct package");
  });

  it("detects a correction equal to the AI value", () => {
    expect(
      isCorrectionUnchanged(extraction, bodyLength, {
        kind: "measurement",
        note: "",
        notInDatasheet: false,
        value: " 4.90  mm ",
      }),
    ).toBe(true);
    expect(
      isCorrectionUnchanged(extraction, standOff, {
        kind: "measurement",
        note: "",
        notInDatasheet: true,
        value: "",
      }),
    ).toBe(true);
    expect(
      isCorrectionUnchanged(extraction, pin0, {
        kind: "pin",
        note: "",
        pinName: "GND",
        pinNumber: "1",
      }),
    ).toBe(true);
    expect(
      isCorrectionUnchanged(extraction, pin0, {
        kind: "pin",
        note: "",
        pinName: "VCC",
        pinNumber: "1",
      }),
    ).toBe(false);
  });

  describe("applyCorrection correctedStatus rules", () => {
    const review = freshReview(extraction);

    it("Not in datasheet gives Not found", () => {
      const next = applyCorrection(extraction, review, bodyLength, {
        kind: "measurement",
        note: "",
        notInDatasheet: true,
        value: "ignored",
      });

      expect(next.measurements[0]).toEqual({
        correctedStatus: "Not found",
        correctedValue: NOT_FOUND_VALUE,
        field: "Body Length",
        status: "corrected",
      });
    });

    it("a value on a row the AI did not extract gives Extracted", () => {
      const onNotFound = applyCorrection(extraction, review, standOff, {
        kind: "measurement",
        note: "",
        notInDatasheet: false,
        value: "0.10 mm",
      });
      const onNeedsReview = applyCorrection(extraction, review, height, {
        kind: "measurement",
        note: "",
        notInDatasheet: false,
        value: "1.70 mm",
      });

      expect(onNotFound.measurements[3].correctedStatus).toBe("Extracted");
      expect(onNeedsReview.measurements[2].correctedStatus).toBe("Extracted");
    });

    it("a value on an Extracted row leaves correctedStatus unset", () => {
      const next = applyCorrection(extraction, review, bodyLength, {
        kind: "measurement",
        note: "  from the drawing ",
        notInDatasheet: false,
        value: " 5.00 mm ",
      });

      expect(next.measurements[0]).toEqual({
        correctionNote: "from the drawing",
        correctedValue: "5.00 mm",
        field: "Body Length",
        status: "corrected",
      });
    });

    it("corrects pins and the package", () => {
      const pinned = applyCorrection(extraction, review, pin2, {
        kind: "pin",
        note: "",
        pinName: " VCC ",
        pinNumber: "8",
      });
      const packaged = applyCorrection(extraction, review, packageRef, {
        kind: "package",
        note: "",
        selectedPackage: "PS (SO, 8)",
      });

      expect(pinned.pins[2]).toEqual({
        correctedPinName: "VCC",
        correctedPinNumber: "8",
        pinIndex: 2,
        status: "corrected",
      });
      expect(packaged.packageSelection).toEqual({
        correctedSelectedPackage: "PS (SO, 8)",
        status: "corrected",
      });
    });

    it("ignores invalid input", () => {
      const next = applyCorrection(extraction, review, pin0, {
        kind: "pin",
        note: "",
        pinName: "",
        pinNumber: "1",
      });

      expect(next).toBe(review);
    });
  });
});

describe("buildSubmissionResolvedView correctedStatus on read", () => {
  const extraction = makeExtraction();

  function resolveWith(field: string, correctedValue: string) {
    const review = freshReview(extraction);

    review.measurements = review.measurements.map((entry) =>
      entry.field === field ? { correctedValue, field, status: "corrected" as const } : entry,
    );

    return buildSubmissionResolvedView({ extraction, review }).fields.find(
      (row) => row.field === field,
    );
  }

  it("derives Not found for a legacy NOT_FOUND_VALUE correction", () => {
    expect(resolveWith("Body Length", NOT_FOUND_VALUE)?.status).toBe("Not found");
  });

  it("derives Extracted for a legacy correction on an AI Not found row", () => {
    const row = resolveWith("Stand Off", "0.10 mm");

    expect(row?.status).toBe("Extracted");
    expect(row?.value).toBe("0.10 mm");
    expect(row?.originalStatus).toBe("Not found");
  });

  it("keeps the AI status for a legacy correction on an Extracted row", () => {
    expect(resolveWith("Body Length", "5.00 mm")?.status).toBe("Extracted");
  });

  it("keeps an explicit correctedStatus", () => {
    const review = freshReview(extraction);

    review.measurements[3] = {
      correctedStatus: "Needs review",
      correctedValue: "0.10 mm",
      field: "Stand Off",
      status: "corrected",
    };

    expect(buildSubmissionResolvedView({ extraction, review }).fields[3].status).toBe(
      "Needs review",
    );
  });
});

describe("classifyRowAttention", () => {
  const extraction = makeExtraction();

  it("is calm for a high-confidence extracted row with evidence", () => {
    expect(classifyRowAttention(extraction, bodyLength)).toEqual([]);
  });

  it("flags confidence, AI status and missing evidence", () => {
    expect(classifyRowAttention(extraction, bodyWidth)).toEqual(["mediumConfidence"]);
    expect(classifyRowAttention(extraction, height)).toEqual(["aiUnsure"]);
    expect(classifyRowAttention(extraction, standOff)).toEqual(["lowConfidence", "notFound"]);
    expect(classifyRowAttention(extraction, pin2)).toEqual(["noEvidence"]);
  });

  it("does not flag missing evidence on legacy extractions without evidence data", () => {
    const legacy = makeExtraction({
      fields: [{ field: "Body Length", status: "Extracted", value: "4.90 mm" }],
      pinRows: [{ pinName: "GND", pinNumber: "1" }],
    });

    expect(classifyRowAttention(legacy, bodyLength)).toEqual([]);
    expect(classifyRowAttention(legacy, pin0)).toEqual([]);
  });

  it("flags duplicate pin numbers", () => {
    const duplicated = makeExtraction({
      pinRows: [
        { confidence: "high", evidencePages: [3], pinName: "GND", pinNumber: "1" },
        { confidence: "high", evidencePages: [3], pinName: "EP", pinNumber: " 1" },
      ],
    });

    expect(classifyRowAttention(duplicated, pin0)).toEqual(["duplicatePinNumber"]);
  });

  it("flags the package when the extraction is flagged or not high confidence", () => {
    expect(classifyRowAttention(extraction, packageRef)).toEqual([]);
    expect(
      classifyRowAttention(
        makeExtraction({ review: { needsReview: true, notes: ["check"] } }),
        packageRef,
      ),
    ).toEqual(["needsReview"]);
    expect(
      classifyRowAttention(
        makeExtraction({
          packageSelection: { alternatives: [], confidence: "low", selectedPackage: "D" },
        }),
        packageRef,
      ),
    ).toEqual(["lowConfidence"]);
  });

  it("adds baseline and run-hint reasons", () => {
    expect(classifyRowAttention(extraction, bodyLength, "match")).toEqual([]);
    expect(classifyRowAttention(extraction, bodyLength, "partial")).toEqual([
      "differsFromBaseline",
    ]);
    expect(
      classifyRowAttention(extraction, bodyLength, {
        agreementOutcome: "mismatch",
        runHints: { "measurement:body length": { differs: 1, partial: 0, runs: 2 } },
      }),
    ).toEqual(["differsFromBaseline", "runsDisagree"]);
    expect(
      classifyRowAttention(extraction, bodyLength, {
        runHints: { "measurement:body length": { differs: 0, partial: 0, runs: 2 } },
      }),
    ).toEqual([]);
  });

  it("flags runsDisagree only when at least half of the runs mismatch", () => {
    const withHint = (differs: number, partial: number, runs: number) =>
      classifyRowAttention(extraction, bodyLength, {
        runHints: { "measurement:body length": { differs, partial, runs } },
      });

    // One weak run out of four is noise, and partial matches never count.
    expect(withHint(1, 0, 4)).toEqual([]);
    expect(withHint(1, 3, 4)).toEqual([]);
    expect(withHint(0, 4, 4)).toEqual([]);
    expect(withHint(2, 0, 4)).toEqual(["runsDisagree"]);
    expect(withHint(3, 1, 4)).toEqual(["runsDisagree"]);
    expect(withHint(1, 0, 1)).toEqual(["runsDisagree"]);
    expect(withHint(1, 0, 2)).toEqual(["runsDisagree"]);
    expect(withHint(1, 1, 3)).toEqual([]);
    expect(withHint(2, 0, 3)).toEqual(["runsDisagree"]);
    expect(withHint(0, 0, 0)).toEqual([]);
  });

  it("decides the run-hint threshold in runHintDisagrees", () => {
    expect(runHintDisagrees({ differs: 2, partial: 0, runs: 4 })).toBe(true);
    expect(runHintDisagrees({ differs: 1, partial: 2, runs: 4 })).toBe(false);
    expect(runHintDisagrees({ differs: 0, partial: 0, runs: 0 })).toBe(false);
    expect(runHintDisagrees(null)).toBe(false);
    expect(runHintDisagrees(undefined)).toBe(false);
  });

  it("describes every reason", () => {
    expect(describeAttentionReason("mediumConfidence")).toBe("Medium confidence");
    expect(describeAttentionReason("noEvidence")).toBe("No evidence page");
    expect(describeAttentionReason("runsDisagree")).toBe("Other model runs differ");
  });
});

describe("bulk confirm", () => {
  const extraction = makeExtraction();

  it("is eligible only for pending, calm, high-confidence extracted rows", () => {
    const review = freshReview(extraction);

    expect(isBulkConfirmEligible(extraction, review, bodyLength)).toBe(true);
    expect(isBulkConfirmEligible(extraction, review, bodyWidth)).toBe(false);
    expect(isBulkConfirmEligible(extraction, review, height)).toBe(false);
    expect(isBulkConfirmEligible(extraction, review, standOff)).toBe(false);
    expect(isBulkConfirmEligible(extraction, review, pin0)).toBe(true);
    expect(isBulkConfirmEligible(extraction, review, pin2)).toBe(false);
    expect(isBulkConfirmEligible(extraction, review, bodyLength, "partial")).toBe(false);
    expect(
      isBulkConfirmEligible(extraction, setDecision(review, bodyLength, "confirmed"), bodyLength),
    ).toBe(false);
  });

  it("treats a missing confidence as not eligible", () => {
    const noConfidence = makeExtraction({
      pinRows: [{ evidencePages: [3], pinName: "GND", pinNumber: "1" }],
    });

    expect(isBulkConfirmEligible(noConfidence, freshReview(noConfidence), pin0)).toBe(false);
  });

  it("plans over visible rows and skips attention rows", () => {
    const review = setDecision(freshReview(extraction), pin1, "confirmed");
    const plan = planBulkConfirm(extraction, review, [bodyLength, bodyWidth, height, pin0, pin1]);

    expect(plan.eligible.map(rowKeyOf)).toEqual(["measurement:body length", "pin:0"]);
    expect(plan.skippedForAttention).toBe(2);
  });

  it("never overwrites confirmed or corrected rows", () => {
    let review = freshReview(extraction);

    review = applyCorrection(extraction, review, pin0, {
      kind: "pin",
      note: "",
      pinName: "VSS",
      pinNumber: "1",
    });
    review = setDecision(review, pin1, "confirmed");

    const result = bulkConfirm(review, [pin0, pin1, pin2, pin2]);

    expect(result.changed).toBe(1);
    expect(result.review.pins[0]).toEqual(review.pins[0]);
    expect(result.review.pins[1].status).toBe("confirmed");
    expect(result.review.pins[2].status).toBe("confirmed");
  });

  it("plans then confirms exactly the eligible rows", () => {
    const review = freshReview(extraction);
    const refs = listReviewRowRefs(extraction);
    const plan = planBulkConfirm(extraction, review, refs);
    const result = bulkConfirm(review, plan.eligible);

    expect(result.changed).toBe(plan.eligible.length);
    expect(getRowDecision(result.review, bodyWidth)).toBe("pending");
    expect(getRowDecision(result.review, height)).toBe("pending");
    expect(getRowDecision(result.review, pin2)).toBe("pending");
    expect(getRowDecision(result.review, bodyLength)).toBe("confirmed");
  });
});

describe("counting", () => {
  const extraction = makeExtraction();

  it("counts per section and per row subset", () => {
    let review = freshReview(extraction);

    review = setDecision(review, packageRef, "confirmed");
    review = setDecision(review, bodyLength, "confirmed");
    review = applyCorrection(extraction, review, pin0, {
      kind: "pin",
      note: "",
      pinName: "VSS",
      pinNumber: "1",
    });

    const sections = countSectionDecisions(review);

    expect(sections.package).toEqual({ confirmed: 1, corrected: 0, pending: 0, total: 1 });
    expect(sections.measurements).toEqual({ confirmed: 1, corrected: 0, pending: 3, total: 4 });
    expect(sections.pins).toEqual({ confirmed: 0, corrected: 1, pending: 2, total: 3 });
    expect(countDecisionsForRows(review, [pin0, pin1])).toEqual({
      confirmed: 0,
      corrected: 1,
      pending: 1,
      total: 2,
    });
  });

  it("counts changed decisions in any field", () => {
    const saved = freshReview(extraction);

    expect(countChangedDecisions(saved, saved)).toBe(0);

    const draft = applyCorrection(
      extraction,
      setDecision(saved, packageRef, "confirmed"),
      bodyLength,
      { kind: "measurement", note: "", notInDatasheet: false, value: "5.00 mm" },
    );

    expect(countChangedDecisions(saved, draft)).toBe(2);
  });

  it("counts an edit to an existing correction", () => {
    const saved = applyCorrection(extraction, freshReview(extraction), bodyLength, {
      kind: "measurement",
      note: "first",
      notInDatasheet: false,
      value: "5.00 mm",
    });
    const noteOnly = applyCorrection(extraction, saved, bodyLength, {
      kind: "measurement",
      note: "second",
      notInDatasheet: false,
      value: "5.00 mm",
    });
    const valueOnly = applyCorrection(extraction, saved, bodyLength, {
      kind: "measurement",
      note: "first",
      notInDatasheet: false,
      value: "5.10 mm",
    });
    const toNotFound = applyCorrection(extraction, saved, bodyLength, {
      kind: "measurement",
      note: "first",
      notInDatasheet: true,
      value: "",
    });

    expect(countChangedDecisions(saved, noteOnly)).toBe(1);
    expect(countChangedDecisions(saved, valueOnly)).toBe(1);
    expect(countChangedDecisions(saved, toNotFound)).toBe(1);
  });

  it("ignores differences that normalize away", () => {
    const saved = freshReview(extraction);
    const draft: SubmissionHumanReview = {
      ...saved,
      // A pending row with a stray note, and a correction with no value, both normalize to pending.
      measurements: saved.measurements.map((entry, index) =>
        index === 0
          ? { ...entry, correctionNote: "stray" }
          : index === 1
            ? { ...entry, correctedValue: " ", status: "corrected" as const }
            : entry,
      ),
    };

    expect(countChangedDecisions(saved, draft)).toBe(0);
  });

  it("is dirty for notes changes alone", () => {
    const saved = freshReview(extraction);

    expect(isReviewDraftDirty(saved, { ...saved, reviewerNotes: "Used the drawing on p. 30" })).toBe(
      true,
    );
    expect(isReviewDraftDirty(saved, { ...saved, reviewerNotes: "   " })).toBe(false);
  });
});

describe("findNextPendingRow", () => {
  const extraction = makeExtraction();
  const order = listReviewRowRefs(extraction);

  it("finds the next pending row after the current one, wrapping", () => {
    let review = freshReview(extraction);

    review = setDecision(review, bodyLength, "confirmed");
    review = setDecision(review, bodyWidth, "confirmed");

    expect(rowKeyOf(findNextPendingRow(review, order, packageRef)!)).toBe("measurement:height");
    expect(rowKeyOf(findNextPendingRow(review, order, pin2)!)).toBe("package");
    expect(rowKeyOf(findNextPendingRow(review, order, null)!)).toBe("package");
  });

  it("goes backwards", () => {
    const review = setDecision(freshReview(extraction), standOff, "confirmed");

    expect(rowKeyOf(findNextPendingRow(review, order, pin0, { direction: -1 })!)).toBe(
      "measurement:height",
    );
  });

  it("never returns the current row and returns null when nothing else is pending", () => {
    const refs = [bodyLength, bodyWidth];
    const review = setDecision(freshReview(extraction), bodyWidth, "confirmed");

    expect(findNextPendingRow(review, refs, bodyLength)).toBeNull();
    expect(findNextPendingRow(review, [], null)).toBeNull();
  });

  it("stops at the end without wrap", () => {
    const review = freshReview(extraction);

    expect(findNextPendingRow(review, order, pin2, { wrap: false })).toBeNull();
  });
});

describe("normalize round-trip keeps the PATCH shape", () => {
  it("round-trips a draft built with the new helpers", () => {
    const extraction = makeExtraction();
    let draft = freshReview(extraction);

    draft = setDecision(draft, packageRef, "confirmed");
    draft = applyCorrection(extraction, draft, bodyLength, {
      kind: "measurement",
      note: "note",
      notInDatasheet: false,
      value: "5.00 mm",
    });
    draft = applyCorrection(extraction, draft, standOff, {
      kind: "measurement",
      note: "",
      notInDatasheet: false,
      value: "0.10 mm",
    });
    draft = applyCorrection(extraction, draft, pin1, {
      kind: "pin",
      note: "",
      pinName: "THR",
      pinNumber: "6",
    });
    draft = bulkConfirm(draft, [pin0, pin2]).review;
    draft = { ...draft, reviewerNotes: "  checked against the drawing  " };

    const normalized = normalizeSubmissionReview(extraction, draft);
    const parsed = submissionReviewPayloadSchema.parse(JSON.parse(JSON.stringify(draft)));

    expect(Object.keys(normalized).sort()).toEqual([
      "measurements",
      "packageSelection",
      "pins",
      "reviewerNotes",
    ]);
    expect(normalizeSubmissionReview(extraction, normalized)).toEqual(normalized);
    expect(countChangedDecisions(draft, normalized)).toBe(0);
    expect(normalizeSubmissionReview(extraction, parsed)).toEqual(normalized);
    expect(normalized.measurements[0]).toMatchObject({
      correctedValue: "5.00 mm",
      field: "Body Length",
      status: "corrected",
    });
    expect(normalized.measurements[3]).toMatchObject({ correctedStatus: "Extracted" });
    expect(normalized.pins.map((entry) => entry.status)).toEqual([
      "confirmed",
      "corrected",
      "confirmed",
    ]);
    expect(normalized.reviewerNotes).toBe("checked against the drawing");

    for (const entry of normalized.measurements) {
      for (const key of Object.keys(entry)) {
        expect(["correctionNote", "correctedStatus", "correctedValue", "field", "status"]).toContain(
          key,
        );
      }
    }

    for (const entry of normalized.pins) {
      for (const key of Object.keys(entry)) {
        expect([
          "correctionNote",
          "correctedPinName",
          "correctedPinNumber",
          "pinIndex",
          "status",
        ]).toContain(key);
      }
    }
  });
});

describe("reviewer notes limit", () => {
  it("matches the review payload schema", () => {
    const review = createDefaultSubmissionReview(makeExtraction());
    const payload = (reviewerNotes: string) =>
      submissionReviewPayloadSchema.safeParse({ ...review, reviewerNotes }).success;

    expect(REVIEWER_NOTES_MAX_LENGTH).toBe(4000);
    expect(payload("a".repeat(REVIEWER_NOTES_MAX_LENGTH))).toBe(true);
    expect(payload("a".repeat(REVIEWER_NOTES_MAX_LENGTH + 1))).toBe(false);
  });
});
