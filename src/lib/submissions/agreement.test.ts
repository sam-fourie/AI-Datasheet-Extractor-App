import { describe, expect, it } from "vitest";

import {
  agreementRowToRerunRef,
  buildBaselineRunHints,
  computeSubmissionAgreement,
  describeAgreementBasis,
  describeRunHint,
  indexAgreementRowsByRerunKey,
  isScoredAgreement,
  listMatchingPendingRefs,
  listOnlyInBaselineRows,
  measurementRowKey,
  PACKAGE_ROW_KEY,
  pinRowKey,
} from "@/lib/submissions/agreement";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import { createDefaultSubmissionReview, setDecision } from "@/lib/submissions/review";
import type {
  ExtractionSnapshot,
  SubmissionAgreement,
  SubmissionHumanReview,
  SubmissionModelRun,
} from "@/lib/submissions/types";

function makeExtraction(overrides: Partial<ExtractionSnapshot> = {}): ExtractionSnapshot {
  return {
    fields: [
      { confidence: "high", evidencePages: [3], field: "Body Length", status: "Extracted", value: "4.90 mm" },
      { confidence: "high", evidencePages: [3], field: "Body Width", status: "Extracted", value: "3.91 mm" },
      { confidence: "high", evidencePages: [3], field: "Stand Off", status: "Not found", value: NOT_FOUND_VALUE },
    ],
    packageSelection: { alternatives: [], confidence: "high", selectedPackage: "D (SOIC, 8)" },
    pinRows: [
      { confidence: "high", evidencePages: [3], pinName: "GND", pinNumber: "1" },
      { confidence: "high", evidencePages: [3], pinName: "TRIG", pinNumber: "2" },
      { confidence: "high", evidencePages: [3], pinName: "OUT", pinNumber: "3" },
    ],
    providerMeta: { model: "gpt-5.4", provider: "openai", reasoningEffort: "high" },
    review: { needsReview: false, notes: [] },
    ...overrides,
  };
}

function confirmAll(extraction: ExtractionSnapshot): SubmissionHumanReview {
  const review = createDefaultSubmissionReview(extraction);

  return {
    ...review,
    measurements: review.measurements.map((entry) => ({ ...entry, status: "confirmed" as const })),
    packageSelection: { status: "confirmed" },
    pins: review.pins.map((entry) => ({ ...entry, status: "confirmed" as const })),
  };
}

describe("computeSubmissionAgreement row keys and indexes", () => {
  const baselineExtraction = makeExtraction();
  const rerun = makeExtraction({
    fields: [
      // Reordered, one value differs.
      { field: "body width", status: "Extracted", value: "3.90 mm" },
      { field: "Body Length", status: "Extracted", value: "4.9 mm" },
    ],
    pinRows: [
      { pinName: "OUT", pinNumber: "3" },
      { pinName: "GND", pinNumber: "1" },
    ],
  });

  it("keys rows and records baseline and re-run indexes", () => {
    const agreement = computeSubmissionAgreement(
      { extraction: baselineExtraction, review: confirmAll(baselineExtraction) },
      rerun,
    );
    const byKey = new Map(agreement.rows.map((row) => [row.key, row]));

    expect(agreement.rows.map((row) => row.key)).toEqual([
      "package",
      "measurement:body length",
      "measurement:body width",
      "measurement:stand off",
      "pin:0",
      "pin:1",
      "pin:2",
    ]);
    expect(byKey.get(PACKAGE_ROW_KEY)).toMatchObject({ outcome: "match" });
    expect(byKey.get(PACKAGE_ROW_KEY)?.baselineIndex).toBeUndefined();
    expect(byKey.get(measurementRowKey("Body Length"))).toMatchObject({
      baselineIndex: 0,
      outcome: "match",
      rerunIndex: 1,
    });
    expect(byKey.get(measurementRowKey("Body Width"))).toMatchObject({
      baselineIndex: 1,
      outcome: "mismatch",
      rerunIndex: 0,
    });
    expect(byKey.get(measurementRowKey("Stand Off"))).toMatchObject({
      baselineIndex: 2,
      outcome: "mismatch",
      rerunValue: "Missing",
    });
    expect(byKey.get(measurementRowKey("Stand Off"))?.rerunIndex).toBeUndefined();
    expect(byKey.get(pinRowKey(0))).toMatchObject({ baselineIndex: 0, outcome: "match", rerunIndex: 1 });
    expect(byKey.get(pinRowKey(1))).toMatchObject({ baselineIndex: 1, outcome: "mismatch" });
    expect(byKey.get(pinRowKey(1))?.rerunIndex).toBeUndefined();
    expect(byKey.get(pinRowKey(2))).toMatchObject({ baselineIndex: 2, outcome: "match", rerunIndex: 0 });
    expect(agreement.basis).toBe("reviewed");
    expect(agreement.baselineReviewStatus).toBe("reviewed");
    expect(agreement.matches).toBe(4);
    expect(agreement.agreementPercentage).toBe(57);
  });

  it("compares only decided rows once the baseline has decisions", () => {
    const review = setDecision(
      createDefaultSubmissionReview(baselineExtraction),
      { field: "Body Length", kind: "measurement" },
      "confirmed",
    );
    const agreement = computeSubmissionAgreement(
      { extraction: baselineExtraction, review },
      rerun,
    );

    expect(agreement.rows.map((row) => row.key)).toEqual(["measurement:body length"]);
    expect(agreement.basis).toBe("reviewed");
    expect(agreement.baselineReviewStatus).toBe("pending");
    expect(isScoredAgreement(agreement)).toBe(false);
  });

  it("scores a legacy correction on an AI Not found field as Extracted", () => {
    const review = confirmAll(baselineExtraction);

    review.measurements[2] = { correctedValue: "0.10 mm", field: "Stand Off", status: "corrected" };

    const agreement = computeSubmissionAgreement(
      { extraction: baselineExtraction, review },
      makeExtraction({
        fields: [{ field: "Stand Off", status: "Extracted", value: "0.1 mm" }],
      }),
    );
    const standOff = agreement.rows.find((row) => row.key === "measurement:stand off");

    expect(standOff).toMatchObject({ baselineValue: "0.10 mm", outcome: "match" });
  });
});

describe("isScoredAgreement", () => {
  const base: SubmissionAgreement = {
    agreementPercentage: 90,
    basis: "reviewed",
    baselineReviewStatus: "reviewed",
    baselineReviewedDecisions: 10,
    baselineTotalDecisions: 10,
    compared: 10,
    matches: 9,
    mismatches: 1,
    partialMatches: 0,
    rows: [],
  };

  it("requires a reviewed basis and a fully reviewed baseline", () => {
    expect(isScoredAgreement(base)).toBe(true);
    expect(isScoredAgreement({ ...base, basis: "unreviewed" })).toBe(false);
    expect(isScoredAgreement({ ...base, baselineReviewStatus: "pending" })).toBe(false);
    expect(isScoredAgreement({ ...base, agreementPercentage: null })).toBe(false);
    expect(isScoredAgreement(null)).toBe(false);
    expect(isScoredAgreement(undefined)).toBe(false);
  });
});

describe("buildBaselineRunHints", () => {
  function run(
    submissionId: string,
    agreement: SubmissionAgreement | null,
    isBaseline = false,
  ): SubmissionModelRun {
    return {
      agreement,
      createdAt: "2026-09-01T00:00:00.000Z",
      isBaseline,
      providerMeta: { model: "gpt-5.6-terra", provider: "openai" },
      reviewProgress: {
        accuracy: null,
        confirmed: 0,
        corrected: 0,
        decided: 0,
        pending: 1,
        state: "notStarted",
        total: 1,
      },
      reviewStatus: "pending",
      submissionId,
    };
  }

  function agreementWith(
    rows: Array<[string, "match" | "mismatch" | "partial"]>,
    basis: "reviewed" | "unreviewed" = "reviewed",
  ): SubmissionAgreement {
    return {
      agreementPercentage: 50,
      basis,
      baselineReviewStatus: basis === "reviewed" ? "reviewed" : "pending",
      baselineReviewedDecisions: 0,
      baselineTotalDecisions: 0,
      compared: rows.length,
      matches: 0,
      mismatches: 0,
      partialMatches: 0,
      rows: rows.map(([key, outcome]) => ({
        baselineValue: "a",
        key,
        kind: "measurement",
        label: key,
        outcome,
        rerunValue: "b",
      })),
    };
  }

  it("counts every re-run's outcome per row key, scored or not", () => {
    const hints = buildBaselineRunHints([
      run("baseline", null, true),
      run("r1", agreementWith([["package", "match"], ["pin:0", "mismatch"]])),
      run(
        "r2",
        agreementWith(
          [["package", "partial"], ["pin:0", "mismatch"], ["pin:1", "match"]],
          "unreviewed",
        ),
      ),
      run("r3", null),
    ]);

    expect(hints).toEqual({
      package: { differs: 0, partial: 1, runs: 2 },
      "pin:0": { differs: 2, partial: 0, runs: 2 },
      "pin:1": { differs: 0, partial: 0, runs: 1 },
    });
  });

  it("returns an empty map without re-runs", () => {
    expect(buildBaselineRunHints([run("baseline", null, true)])).toEqual({});
  });

  it("describes hints by mismatching runs only", () => {
    expect(describeRunHint({ differs: 2, partial: 1, runs: 4 })).toBe("2 of 4 runs differ");
    expect(describeRunHint({ differs: 2, partial: 0, runs: 4 })).toBe("2 of 4 runs differ");
    expect(describeRunHint({ differs: 1, partial: 0, runs: 1 })).toBe("1 of 1 run differs");
    expect(describeRunHint({ differs: 0, partial: 3, runs: 4 })).toBeNull();
    expect(describeRunHint({ differs: 0, partial: 0, runs: 4 })).toBeNull();
    expect(describeRunHint(undefined)).toBeNull();
  });
});

describe("re-run row mapping", () => {
  const baselineExtraction = makeExtraction();
  // Pin 2 is missing, pin 4 is extra, pins are reordered, Stand Off is missing
  // and Body Width only partly matches ("3.91 mm" is one of two numbers).
  const rerunExtraction = makeExtraction({
    fields: [
      { field: "body width", status: "Extracted", value: "3.91 mm to 3.99 mm" },
      { field: "Body Length", status: "Extracted", value: "4.90 mm" },
    ],
    pinRows: [
      { pinName: "OUT", pinNumber: "3" },
      { pinName: "VCC", pinNumber: "4" },
      { pinName: "GND", pinNumber: "1" },
    ],
  });
  const agreement = computeSubmissionAgreement(
    { extraction: baselineExtraction, review: confirmAll(baselineExtraction) },
    rerunExtraction,
  );
  const rowByKey = (key: string) => {
    const row = agreement.rows.find((entry) => entry.key === key);

    if (!row) {
      throw new Error(`missing agreement row ${key}`);
    }

    return row;
  };

  it("maps baseline-keyed rows onto the re-run's own rows", () => {
    expect(agreementRowToRerunRef(rowByKey(PACKAGE_ROW_KEY), rerunExtraction)).toEqual({
      kind: "package",
    });
    expect(
      agreementRowToRerunRef(rowByKey(measurementRowKey("Body Width")), rerunExtraction),
    ).toEqual({ field: "body width", kind: "measurement" });
    expect(agreementRowToRerunRef(rowByKey(pinRowKey(0)), rerunExtraction)).toEqual({
      kind: "pin",
      pinIndex: 2,
    });
    expect(agreementRowToRerunRef(rowByKey(pinRowKey(2)), rerunExtraction)).toEqual({
      kind: "pin",
      pinIndex: 0,
    });
  });

  it("returns null for rows the re-run does not have", () => {
    expect(agreementRowToRerunRef(rowByKey(pinRowKey(1)), rerunExtraction)).toBeNull();
    expect(
      agreementRowToRerunRef(rowByKey(measurementRowKey("Stand Off")), rerunExtraction),
    ).toBeNull();
    expect(
      agreementRowToRerunRef({ ...rowByKey(pinRowKey(0)), rerunIndex: 9 }, rerunExtraction),
    ).toBeNull();
    expect(
      agreementRowToRerunRef(
        { ...rowByKey(measurementRowKey("Body Length")), rerunIndex: 9 },
        rerunExtraction,
      ),
    ).toBeNull();
  });

  it("indexes agreement rows by the re-run's row keys", () => {
    const byKey = indexAgreementRowsByRerunKey(agreement, rerunExtraction);

    expect(Array.from(byKey.keys()).sort()).toEqual([
      "measurement:body length",
      "measurement:body width",
      "package",
      "pin:0",
      "pin:2",
    ]);
    expect(byKey.get("pin:0")).toMatchObject({ key: "pin:2", label: "Pin 3", outcome: "match" });
    expect(byKey.get("pin:2")).toMatchObject({ key: "pin:0", label: "Pin 1", outcome: "match" });
    expect(byKey.get("measurement:body width")?.outcome).toBe("partial");
    // The extra pin 4 has no baseline counterpart.
    expect(byKey.has("pin:1")).toBe(false);
    expect(indexAgreementRowsByRerunKey(null, rerunExtraction).size).toBe(0);
  });

  it("lists baseline rows missing from the re-run, never the package", () => {
    expect(
      listOnlyInBaselineRows(agreement, rerunExtraction).map((row) => row.label),
    ).toEqual(["Stand Off", "Pin 2"]);
    expect(listOnlyInBaselineRows(undefined, rerunExtraction)).toEqual([]);
  });

  it("lists matching rows that are still pending, excluding partials", () => {
    const review = createDefaultSubmissionReview(rerunExtraction);

    expect(listMatchingPendingRefs(agreement, rerunExtraction, review)).toEqual([
      { kind: "package" },
      { field: "Body Length", kind: "measurement" },
      { kind: "pin", pinIndex: 2 },
      { kind: "pin", pinIndex: 0 },
    ]);

    const decided = setDecision(review, { kind: "pin", pinIndex: 2 }, "confirmed");

    expect(listMatchingPendingRefs(agreement, rerunExtraction, decided)).toEqual([
      { kind: "package" },
      { field: "Body Length", kind: "measurement" },
      { kind: "pin", pinIndex: 0 },
    ]);
    expect(listMatchingPendingRefs(null, rerunExtraction, review)).toEqual([]);
  });
});

describe("describeAgreementBasis", () => {
  const scored: SubmissionAgreement = {
    agreementPercentage: 86,
    basis: "reviewed",
    baselineReviewStatus: "reviewed",
    baselineReviewedDecisions: 7,
    baselineTotalDecisions: 7,
    compared: 7,
    matches: 6,
    mismatches: 1,
    partialMatches: 0,
    rows: [],
  };

  it("scores only a fully reviewed baseline", () => {
    expect(describeAgreementBasis(scored)).toEqual({
      scored: true,
      text: "86% agreement",
      value: 86,
    });
    expect(
      describeAgreementBasis({
        ...scored,
        baselineReviewStatus: "pending",
        baselineReviewedDecisions: 3,
      }),
    ).toEqual({ scored: false, text: "vs partly reviewed baseline (3 of 7)", value: 86 });
    expect(describeAgreementBasis({ ...scored, basis: "unreviewed" })).toEqual({
      scored: false,
      text: "vs unreviewed baseline",
      value: 86,
    });
  });

  it("handles a missing agreement or baseline", () => {
    expect(describeAgreementBasis(null)).toEqual({ scored: false, text: "Not scored", value: null });
    expect(describeAgreementBasis(scored, { baselineMissing: true })).toEqual({
      scored: false,
      text: "Baseline deleted",
      value: null,
    });
  });
});
