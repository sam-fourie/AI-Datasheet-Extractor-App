import { describe, expect, it } from "vitest";

import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import {
  applyCorrection,
  createDefaultSubmissionReview,
  rowKeyOf,
  setDecision,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import {
  computeVisibleRows,
  createAttentionContextResolver,
  describeFilteredOutSection,
  matchesReviewFilter,
  pinMatchesQuery,
  type FilteredSection,
  type ReviewFilter,
} from "@/lib/submissions/review-filters";
import type {
  BaselineRunHints,
  ExtractionSnapshot,
  SubmissionAgreementRow,
} from "@/lib/submissions/types";

function makeExtraction(overrides: Partial<ExtractionSnapshot> = {}): ExtractionSnapshot {
  return {
    fields: [
      // Calm.
      { confidence: "high", evidencePages: [3], field: "Body Length", status: "Extracted", value: "4.90 mm" },
      // Medium confidence.
      { confidence: "medium", evidencePages: [3], field: "Body Width", status: "Extracted", value: "3.91 mm" },
      // Not found.
      { confidence: "low", evidencePages: [], field: "Stand Off", status: "Not found", value: NOT_FOUND_VALUE },
    ],
    packageSelection: { alternatives: [], confidence: "high", selectedPackage: "D (SOIC, 8)" },
    pinRows: [
      { confidence: "high", evidencePages: [3], pinName: "GND", pinNumber: "1" },
      { confidence: "high", evidencePages: [3], pinName: "TRIG", pinNumber: "2" },
      { confidence: "high", evidencePages: [30], pinName: "V_CC", pinNumber: "8" },
    ],
    providerMeta: { model: "gpt-5.6-terra", provider: "openai", reasoningEffort: "high" },
    review: { needsReview: false, notes: [] },
    ...overrides,
  };
}

const packageRef: ReviewRowRef = { kind: "package" };
const bodyLength: ReviewRowRef = { field: "Body Length", kind: "measurement" };
const bodyWidth: ReviewRowRef = { field: "Body Width", kind: "measurement" };
const standOff: ReviewRowRef = { field: "Stand Off", kind: "measurement" };
const pin0: ReviewRowRef = { kind: "pin", pinIndex: 0 };
const pin1: ReviewRowRef = { kind: "pin", pinIndex: 1 };
const pin2: ReviewRowRef = { kind: "pin", pinIndex: 2 };

const extraction = makeExtraction();

function agreementRow(key: string, outcome: SubmissionAgreementRow["outcome"]): SubmissionAgreementRow {
  return { baselineValue: "a", key, kind: "measurement", label: key, outcome, rerunValue: "b" };
}

describe("matchesReviewFilter", () => {
  const review = createDefaultSubmissionReview(extraction);

  it("passes every row for all", () => {
    expect(matchesReviewFilter("all", extraction, review, bodyLength)).toBe(true);
    expect(matchesReviewFilter("all", extraction, review, pin2)).toBe(true);
  });

  it("filters pending and incorrect by decision", () => {
    const confirmed = setDecision(review, bodyLength, "confirmed");
    const corrected = applyCorrection(extraction, confirmed, pin1, {
      kind: "pin",
      note: "",
      pinName: "THR",
      pinNumber: "2",
    });

    expect(matchesReviewFilter("pending", extraction, review, bodyLength)).toBe(true);
    expect(matchesReviewFilter("pending", extraction, confirmed, bodyLength)).toBe(false);
    expect(matchesReviewFilter("incorrect", extraction, confirmed, bodyLength)).toBe(false);
    expect(matchesReviewFilter("incorrect", extraction, corrected, pin1)).toBe(true);
    expect(matchesReviewFilter("pending", extraction, corrected, pin1)).toBe(false);
  });

  it("uses classifyRowAttention for attention", () => {
    expect(matchesReviewFilter("attention", extraction, review, bodyLength)).toBe(false);
    expect(matchesReviewFilter("attention", extraction, review, bodyWidth)).toBe(true);
    expect(matchesReviewFilter("attention", extraction, review, standOff)).toBe(true);
    expect(
      matchesReviewFilter("attention", extraction, review, bodyLength, { agreementOutcome: "partial" }),
    ).toBe(true);
  });

  it("treats mismatches and partials as differing from the baseline", () => {
    expect(matchesReviewFilter("differs", extraction, review, bodyLength, { agreementOutcome: "mismatch" })).toBe(true);
    expect(matchesReviewFilter("differs", extraction, review, bodyLength, { agreementOutcome: "partial" })).toBe(true);
    expect(matchesReviewFilter("differs", extraction, review, bodyLength, { agreementOutcome: "match" })).toBe(false);
    expect(matchesReviewFilter("differs", extraction, review, bodyLength, null)).toBe(false);
  });

  it("matches runs disagree only when at least half of the runs mismatch", () => {
    const withHint = (differs: number, partial: number, runs: number) =>
      matchesReviewFilter("runsDisagree", extraction, review, bodyLength, {
        runHints: { [rowKeyOf(bodyLength)]: { differs, partial, runs } },
      });

    expect(withHint(1, 0, 4)).toBe(false);
    expect(withHint(1, 3, 4)).toBe(false);
    expect(withHint(2, 0, 4)).toBe(true);
    expect(withHint(1, 0, 1)).toBe(true);
    expect(matchesReviewFilter("runsDisagree", extraction, review, bodyLength)).toBe(false);
  });
});

describe("createAttentionContextResolver", () => {
  it("looks up the re-run row's agreement outcome by its own key", () => {
    const resolve = createAttentionContextResolver({
      comparison: {
        agreementByKey: new Map([
          [rowKeyOf(bodyWidth), agreementRow("measurement:body width", "partial")],
          [rowKeyOf(pin0), agreementRow("pin:3", "mismatch")],
        ]),
      },
    });

    expect(resolve(bodyWidth)).toEqual({ agreementOutcome: "partial", runHints: null });
    expect(resolve(pin0)).toEqual({ agreementOutcome: "mismatch", runHints: null });
    expect(resolve(bodyLength)).toEqual({ agreementOutcome: null, runHints: null });
  });

  it("passes the baseline's run hints through", () => {
    const runHints: BaselineRunHints = { [rowKeyOf(pin1)]: { differs: 2, partial: 0, runs: 3 } };
    const resolve = createAttentionContextResolver({ comparison: null, runHints });

    expect(resolve(pin1)).toEqual({ agreementOutcome: null, runHints });
    expect(createAttentionContextResolver({})(pin1)).toEqual({ agreementOutcome: null, runHints: null });
  });
});

describe("pinMatchesQuery", () => {
  const gnd = { pinName: "GND", pinNumber: "1" };
  const vcc = { pinName: "V_CC", pinNumber: "8" };

  it("matches every pin for an empty or punctuation-only query", () => {
    expect(pinMatchesQuery(gnd, "")).toBe(true);
    expect(pinMatchesQuery(gnd, "   ")).toBe(true);
    expect(pinMatchesQuery(gnd, "--")).toBe(true);
  });

  it("matches the exact pin number", () => {
    expect(pinMatchesQuery(gnd, "1")).toBe(true);
    expect(pinMatchesQuery(vcc, "1")).toBe(false);
    expect(pinMatchesQuery(vcc, " 8 ")).toBe(true);
  });

  it("matches names ignoring case and punctuation", () => {
    expect(pinMatchesQuery(gnd, "gn")).toBe(true);
    expect(pinMatchesQuery(vcc, "vcc")).toBe(true);
    expect(pinMatchesQuery(vcc, "V-CC")).toBe(true);
    expect(pinMatchesQuery(vcc, "gnd")).toBe(false);
  });

  it("matches number and name typed together", () => {
    expect(pinMatchesQuery(vcc, "8 vcc")).toBe(true);
    expect(pinMatchesQuery(gnd, "1gnd")).toBe(true);
    expect(pinMatchesQuery(gnd, "2gnd")).toBe(false);
  });
});

describe("computeVisibleRows", () => {
  const review = createDefaultSubmissionReview(extraction);
  const allRefs = [packageRef, bodyLength, bodyWidth, standOff, pin0, pin1, pin2];

  it("orders package, measurements, then pins", () => {
    const visible = computeVisibleRows({ extraction, filter: "all", review });

    expect(visible.order).toEqual(allRefs);
    expect(Array.from(visible.keys)).toEqual(allRefs.map(rowKeyOf));
  });

  it("follows the grouped pin order when given", () => {
    const visible = computeVisibleRows({ extraction, filter: "all", pinOrder: [2, 0, 1], review });

    expect(visible.order).toEqual([packageRef, bodyLength, bodyWidth, standOff, pin2, pin0, pin1]);
  });

  it("applies the filter", () => {
    const decided = setDecision(setDecision(review, bodyLength, "confirmed"), pin0, "confirmed");

    expect(computeVisibleRows({ extraction, filter: "pending", review: decided }).order).toEqual([
      packageRef,
      bodyWidth,
      standOff,
      pin1,
      pin2,
    ]);
    expect(computeVisibleRows({ extraction, filter: "attention", review }).order).toEqual([
      bodyWidth,
      standOff,
    ]);
  });

  it("keeps sticky rows visible although the filter excludes them", () => {
    const decided = setDecision(review, bodyWidth, "confirmed");
    const visible = computeVisibleRows({
      extraction,
      filter: "pending",
      review: decided,
      stickyKeys: new Set([rowKeyOf(bodyWidth)]),
    });

    expect(visible.order).toEqual(allRefs);
    expect(visible.keys.has(rowKeyOf(bodyWidth))).toBe(true);
  });

  it("applies the pin search to pins only, sticky pins excepted", () => {
    expect(computeVisibleRows({ extraction, filter: "all", pinQuery: "trig", review }).order).toEqual([
      packageRef,
      bodyLength,
      bodyWidth,
      standOff,
      pin1,
    ]);
    expect(
      computeVisibleRows({
        extraction,
        filter: "all",
        pinQuery: "trig",
        review,
        stickyKeys: new Set([rowKeyOf(pin2)]),
      }).order,
    ).toEqual([packageRef, bodyLength, bodyWidth, standOff, pin1, pin2]);
  });

  it("combines search and filter, and uses the per-row context", () => {
    const contextFor = createAttentionContextResolver({
      comparison: {
        agreementByKey: new Map([
          [rowKeyOf(bodyLength), agreementRow("measurement:body length", "mismatch")],
          [rowKeyOf(pin0), agreementRow("pin:0", "partial")],
          [rowKeyOf(pin1), agreementRow("pin:1", "match")],
        ]),
      },
    });

    expect(computeVisibleRows({ contextFor, extraction, filter: "differs", review }).order).toEqual([
      bodyLength,
      pin0,
    ]);
    expect(
      computeVisibleRows({ contextFor, extraction, filter: "differs", pinQuery: "trig", review }).order,
    ).toEqual([bodyLength]);
  });
});

describe("describeFilteredOutSection", () => {
  const filters: ReviewFilter[] = ["all", "pending", "attention", "incorrect", "differs", "runsDisagree"];
  const sections: FilteredSection[] = ["package", "measurements", "pins"];

  it("says the section agrees with its baseline rather than that it is empty", () => {
    expect(describeFilteredOutSection("differs", "measurements")).toBe(
      "No measurements differ from the baseline.",
    );
    expect(describeFilteredOutSection("differs", "pins")).toBe("No pins differ from the baseline.");
    expect(describeFilteredOutSection("differs", "package")).toBe(
      "The package doesn't differ from the baseline.",
    );
  });

  it("names what each filter looked for", () => {
    expect(describeFilteredOutSection("pending", "pins")).toBe("Every pin is decided.");
    expect(describeFilteredOutSection("attention", "measurements")).toBe(
      "No measurements need attention.",
    );
    expect(describeFilteredOutSection("incorrect", "pins")).toBe("No pins are marked incorrect.");
    expect(describeFilteredOutSection("runsDisagree", "measurements")).toBe(
      "Most runs agree on every measurement.",
    );
  });

  it("falls back to the generic line for All", () => {
    expect(describeFilteredOutSection("all", "pins")).toBe("No pins match this filter.");
    expect(describeFilteredOutSection("all", "package")).toBe("The package doesn't match this filter.");
  });

  it("has a sentence for every filter and section", () => {
    for (const filter of filters) {
      for (const section of sections) {
        expect(describeFilteredOutSection(filter, section)).toMatch(/^[A-Z].*\.$/);
      }
    }
  });
});
