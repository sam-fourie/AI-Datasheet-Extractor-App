import { describe, expect, it } from "vitest";

import {
  applyCorrection,
  bulkConfirm,
  createDefaultSubmissionReview,
  getRowDecision,
  rowKeyOf,
  setDecision,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import type { ExtractionSnapshot, SubmissionHumanReview } from "@/lib/submissions/types";

import {
  listBulkConfirmChanges,
  refreshCompletion,
  revertBulkConfirm,
} from "./workspace-model";

function makeExtraction(): ExtractionSnapshot {
  return {
    fields: [
      { confidence: "high", evidencePages: [3], field: "Body Length", status: "Extracted", value: "4.90 mm" },
      { confidence: "high", evidencePages: [3], field: "Body Width", status: "Extracted", value: "3.91 mm" },
    ],
    packageSelection: { alternatives: [], confidence: "high", selectedPackage: "D (SOIC, 8)" },
    pinRows: [
      { confidence: "high", evidencePages: [3], pinName: "GND", pinNumber: "1" },
      { confidence: "high", evidencePages: [3], pinName: "TRIG", pinNumber: "2" },
      { confidence: "high", evidencePages: [3], pinName: "OUT", pinNumber: "3" },
    ],
    providerMeta: { model: "gpt-5.4", provider: "openai", reasoningEffort: "high" },
    review: { needsReview: false, notes: [] },
  };
}

const packageRef: ReviewRowRef = { kind: "package" };
const bodyLength: ReviewRowRef = { field: "Body Length", kind: "measurement" };
const bodyWidth: ReviewRowRef = { field: "Body Width", kind: "measurement" };
const pin0: ReviewRowRef = { kind: "pin", pinIndex: 0 };
const pin1: ReviewRowRef = { kind: "pin", pinIndex: 1 };
const pin2: ReviewRowRef = { kind: "pin", pinIndex: 2 };

function decide(review: SubmissionHumanReview, refs: ReviewRowRef[]) {
  return refs.reduce((next, ref) => setDecision(next, ref, "confirmed"), review);
}

describe("bulk confirm undo", () => {
  it("lists only the distinct rows that were pending", () => {
    const review = setDecision(createDefaultSubmissionReview(makeExtraction()), pin1, "confirmed");

    expect(listBulkConfirmChanges(review, [pin0, pin1, pin0, pin2]).map(rowKeyOf)).toEqual([
      "pin:0",
      "pin:2",
    ]);
  });

  it("returns the changed rows to pending and keeps edits made after the bulk action", () => {
    const extraction = makeExtraction();
    const before = setDecision(createDefaultSubmissionReview(extraction), pin1, "confirmed");
    const refs = [pin0, pin1, pin2];
    const changed = listBulkConfirmChanges(before, refs);
    const afterBulk = bulkConfirm(before, refs).review;
    // Within the toast's 8 s: a correction on pin 2, and a new decision elsewhere.
    const later = setDecision(
      applyCorrection(extraction, afterBulk, pin2, { kind: "pin", note: "", pinName: "OUTPUT", pinNumber: "3" }),
      bodyLength,
      "confirmed",
    );
    const reverted = revertBulkConfirm({ ...later, reviewerNotes: "typed later" }, changed);

    expect(getRowDecision(reverted, pin0)).toBe("pending");
    // Confirmed before the bulk action: untouched.
    expect(getRowDecision(reverted, pin1)).toBe("confirmed");
    // Corrected after the bulk action: untouched.
    expect(getRowDecision(reverted, pin2)).toBe("corrected");
    expect(getRowDecision(reverted, bodyLength)).toBe("confirmed");
    expect(reverted.reviewerNotes).toBe("typed later");
  });

  it("is a no-op when nothing it changed is still confirmed", () => {
    const review = createDefaultSubmissionReview(makeExtraction());

    expect(revertBulkConfirm(review, [pin0, pin1])).toBe(review);
  });
});

describe("refreshCompletion", () => {
  const card = { summary: "old", title: "NE555 reviewed" };
  const allRefs = [packageRef, bodyLength, bodyWidth, pin0, pin1, pin2];

  it("recomputes the summary while the saved review is fully decided", () => {
    const extraction = makeExtraction();
    const saved = applyCorrection(
      extraction,
      decide(createDefaultSubmissionReview(extraction), allRefs),
      pin2,
      { kind: "pin", note: "", pinName: "OUTPUT", pinNumber: "3" },
    );

    expect(refreshCompletion(card, saved)).toEqual({
      summary: "83% accurate · 5 confirmed · 1 corrected",
      title: "NE555 reviewed",
    });
  });

  it("drops the card once a row is pending again", () => {
    const saved = setDecision(
      decide(createDefaultSubmissionReview(makeExtraction()), allRefs),
      pin0,
      "pending",
    );

    expect(refreshCompletion(card, saved)).toBeNull();
  });

  it("never creates a card", () => {
    const saved = decide(createDefaultSubmissionReview(makeExtraction()), allRefs);

    expect(refreshCompletion(null, saved)).toBeNull();
  });
});
