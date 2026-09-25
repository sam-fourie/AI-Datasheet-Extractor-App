/**
 * Review fixtures for the preview sandbox and component checks. No database:
 * agreement, progress and review status are derived with the real lib
 * functions, so the fixtures stay consistent with the rules.
 *
 * - `smallBaselineFixture`: MMBT3904LT1G, SOT-23, 3 pins, reviewed (1 correction). No runs.
 * - `rerunFixture`: NE555DR re-run (GPT-5.6 Sol · Medium), 8 pins, scored against the
 *   reviewed NE555DR baseline (`ne555BaselineFixture`), partly reviewed itself.
 *   `ne555RunsFixture` is the group's run list (baseline + 4 re-runs).
 * - `largeBaselineFixture`: CY8C5668AXI-LP010, 108 pins (100 + 8 duplicated/extra
 *   rows) across pages 9 to 13 plus a few without evidence, unreviewed and flagged.
 *   `largeRunsFixture` has 2 unscored runs (vs an unreviewed baseline) that
 *   drive run hints.
 */

import type {
  ConfidenceLevel,
  MeasurementFieldRow,
  MeasurementFieldStatus,
  PinRow,
  ProviderMeta,
} from "@/lib/package-categories";
import { computeSubmissionAgreement } from "@/lib/submissions/agreement";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import {
  countReviewDecisions,
  createDefaultSubmissionReview,
  deriveReviewProgress,
  deriveSubmissionReviewStatus,
} from "@/lib/submissions/review";
import type {
  ExtractionSnapshot,
  SubmissionComparison,
  SubmissionDetail,
  SubmissionHumanReview,
  SubmissionIntakeSnapshot,
  SubmissionModelRun,
} from "@/lib/submissions/types";

/* -------------------------------- Builders --------------------------------- */

function measurement(
  field: string,
  value: string,
  confidence: ConfidenceLevel,
  evidencePages: number[],
  status: MeasurementFieldStatus = "Extracted",
): MeasurementFieldRow {
  return {
    confidence,
    evidencePages,
    field,
    status,
    value: status === "Not found" ? NOT_FOUND_VALUE : value,
  };
}

function pin(
  pinNumber: string,
  pinName: string,
  evidencePages: number[],
  confidence: ConfidenceLevel = "high",
): PinRow {
  return { confidence, evidencePages, pinName, pinNumber };
}

function providerMeta(
  model: string,
  reasoningEffort: string,
  latencyMs: number,
  estimatedCostUsd: number,
  tokens: { input: number; output: number; reasoning: number },
): ProviderMeta {
  return {
    estimatedCostUsd,
    latencyMs,
    model,
    provider: "openai",
    reasoningEffort,
    responseId: `resp_${model.replace(/[^a-z0-9]/gi, "")}_${Math.round(latencyMs)}`,
    usage: {
      cachedInputTokens: 0,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      reasoningTokens: tokens.reasoning,
      totalTokens: tokens.input + tokens.output,
    },
  };
}

function buildDetail(input: {
  comparison?: SubmissionComparison;
  createdAt: string;
  extraction: ExtractionSnapshot;
  intake: SubmissionIntakeSnapshot;
  review: SubmissionHumanReview;
  reviewedAt?: string | null;
  submissionId: string;
  updatedAt?: string;
}): SubmissionDetail {
  const counts = countReviewDecisions(input.review);
  const reviewStatus = deriveSubmissionReviewStatus(input.review);

  return {
    ...(input.comparison ? { comparison: input.comparison } : {}),
    createdAt: input.createdAt,
    extraction: input.extraction,
    intake: input.intake,
    providerMeta: input.extraction.providerMeta,
    review: input.review,
    reviewDecisionCounts: counts,
    reviewStatus,
    reviewedAt: reviewStatus === "reviewed" ? (input.reviewedAt ?? input.updatedAt ?? input.createdAt) : null,
    submissionId: input.submissionId,
    updatedAt: input.updatedAt ?? input.createdAt,
  };
}

function toModelRun(detail: SubmissionDetail, baseline: SubmissionDetail | null): SubmissionModelRun {
  return {
    agreement:
      detail.comparison && baseline
        ? computeSubmissionAgreement(baseline, detail.extraction)
        : null,
    createdAt: detail.createdAt,
    isBaseline: !detail.comparison,
    providerMeta: detail.providerMeta,
    reviewProgress: deriveReviewProgress(detail.reviewDecisionCounts),
    reviewStatus: detail.reviewStatus,
    submissionId: detail.submissionId,
  };
}

/** A review with every row confirmed. */
function confirmAll(
  extraction: ExtractionSnapshot,
  reviewerNotes = "",
): SubmissionHumanReview {
  const review = createDefaultSubmissionReview(extraction);

  return {
    measurements: review.measurements.map((entry) => ({ ...entry, status: "confirmed" as const })),
    packageSelection: { status: "confirmed" },
    pins: review.pins.map((entry) => ({ ...entry, status: "confirmed" as const })),
    reviewerNotes,
  };
}

/* --------------------- 1. MMBT3904LT1G, 3-pin baseline ---------------------- */

const smallExtraction: ExtractionSnapshot = {
  fields: [
    measurement("Body Length", "2.80 mm to 3.04 mm", "high", [4]),
    measurement("Body Width", "1.20 mm to 1.40 mm", "high", [4]),
    measurement("Height", "0.89 mm to 1.11 mm", "high", [4]),
    measurement("Pin Length", "0.35 mm to 0.69 mm", "medium", [4]),
    measurement("Pin Pitch", "0.95 mm", "high", [4]),
    measurement("Pin Span", "2.10 mm to 2.64 mm", "high", [4]),
    measurement("Pin Width 1", "0.37 mm to 0.50 mm", "high", [4]),
    measurement("Stand Off", "0.01 mm to 0.10 mm", "high", [4]),
  ],
  packageSelection: {
    alternatives: ["SOT-23-3 (TO-236)"],
    confidence: "high",
    selectedPackage: "SOT-23 (TO-236AB), case 318-08",
  },
  pinRows: [pin("1", "BASE", [1]), pin("2", "EMITTER", [1]), pin("3", "COLLECTOR", [1])],
  providerMeta: providerMeta("gpt-5.4", "high", 14_280, 0.061, { input: 38_412, output: 1_022, reasoning: 402 }),
  review: { needsReview: false, notes: [] },
};

export const smallBaselineFixture: SubmissionDetail = buildDetail({
  createdAt: "2026-09-18T09:12:44.000Z",
  extraction: smallExtraction,
  intake: {
    packageCategory: "SOT23 (3-Pin)",
    partNumber: "MMBT3904LT1G",
    requestedFields: smallExtraction.fields.map((field) => field.field),
    sourceLabel: "MMBT3904LT1-D.PDF",
    sourceMeta: {
      checksumSha256: "9f2c4d1a7be0c3f51d0a2e6b8c4f7a19d3e5b6c7a8f90123456789abcdef0123",
      fileName: "MMBT3904LT1-D.PDF",
      kind: "upload",
      mimeType: "application/pdf",
      objectKey: "datasheets/uploads/2026/09/18/mmbt3904lt1-d.pdf",
      sizeBytes: 214_880,
      storageProvider: "cloudflare-r2",
    },
    sourceMode: "upload",
  },
  review: (() => {
    const review = confirmAll(smallExtraction, "Used the SOT-23 case 318-08 drawing on page 4.");

    return {
      ...review,
      measurements: review.measurements.map((entry) =>
        entry.field === "Pin Width 1"
          ? {
              correctionNote: "Table shows b = 0.30 to 0.50",
              correctedValue: "0.30 mm to 0.50 mm",
              field: entry.field,
              status: "corrected" as const,
            }
          : entry,
      ),
    };
  })(),
  reviewedAt: "2026-09-18T09:31:02.000Z",
  submissionId: "fx-mmbt3904-baseline",
  updatedAt: "2026-09-18T09:31:02.000Z",
});

export const smallRunsFixture: SubmissionModelRun[] = [toModelRun(smallBaselineFixture, null)];

/* --------------------------- 2. NE555DR group ------------------------------- */

const ne555Pins = [
  pin("1", "GND", [3]),
  pin("2", "TRIG", [3]),
  pin("3", "OUT", [3]),
  pin("4", "RESET", [3]),
  pin("5", "CONT", [3]),
  pin("6", "THRES", [3]),
  pin("7", "DISCH", [3]),
  pin("8", "VCC", [3]),
];

const ne555BaselineExtraction: ExtractionSnapshot = {
  fields: [
    measurement("Body Length", "4.81 mm to 5.00 mm", "high", [30]),
    measurement("Body Width", "3.81 mm to 3.98 mm", "high", [30]),
    measurement("Height", "1.75 mm max", "high", [30]),
    measurement("Pin Length", "1.04 mm", "medium", [30]),
    measurement("Pin Pitch", "1.27 mm", "high", [30]),
    measurement("Pin Span", "5.80 mm to 6.19 mm", "high", [30]),
    measurement("Pin Width", "0.31 mm to 0.51 mm", "high", [30]),
    measurement("Stand Off", "0.10 mm to 0.25 mm", "high", [30]),
    measurement("Thermal Pad Length", "", "high", [], "Not found"),
    measurement("Thermal Pad Width", "", "high", [], "Not found"),
  ],
  packageSelection: {
    alternatives: ["PS (SO, 8)", "PW (TSSOP, 8)"],
    confidence: "high",
    selectedPackage: "D (SOIC, 8)",
  },
  pinRows: ne555Pins,
  providerMeta: providerMeta("gpt-5.4", "high", 21_604, 0.118, { input: 96_310, output: 1_480, reasoning: 612 }),
  review: { needsReview: false, notes: ["Package drawing D0008A on page 30 was used for all body dimensions."] },
};

export const ne555BaselineFixture: SubmissionDetail = buildDetail({
  createdAt: "2026-03-27T14:02:10.000Z",
  extraction: ne555BaselineExtraction,
  intake: {
    packageCategory: "Small Outline Packages",
    partNumber: "NE555DR",
    requestedFields: ne555BaselineExtraction.fields.map((field) => field.field),
    sourceLabel: "https://www.ti.com/lit/ds/symlink/ne555.pdf",
    sourceMeta: { kind: "url", normalizedUrl: "https://www.ti.com/lit/ds/symlink/ne555.pdf", pdfFileName: "ne555.pdf" },
    sourceMode: "url",
  },
  review: (() => {
    const review = confirmAll(ne555BaselineExtraction, "Pin length checked against L on the D0008A drawing.");

    return {
      ...review,
      measurements: review.measurements.map((entry) =>
        entry.field === "Pin Length"
          ? {
              correctionNote: "L is 0.41 to 1.27 mm; 1.04 is the typical value",
              correctedValue: "0.41 mm to 1.27 mm",
              field: entry.field,
              status: "corrected" as const,
            }
          : entry,
      ),
    };
  })(),
  reviewedAt: "2026-09-21T10:48:00.000Z",
  submissionId: "fx-ne555-baseline",
  updatedAt: "2026-09-21T10:48:00.000Z",
});

function ne555Rerun(
  submissionId: string,
  createdAt: string,
  meta: ProviderMeta,
  changes: {
    fields?: Record<string, Partial<MeasurementFieldRow>>;
    pinRows?: PinRow[];
    selectedPackage?: string;
  },
  review?: (extraction: ExtractionSnapshot) => SubmissionHumanReview,
): SubmissionDetail {
  const extraction: ExtractionSnapshot = {
    fields: ne555BaselineExtraction.fields.map((field) => ({ ...field, ...changes.fields?.[field.field] })),
    packageSelection: {
      ...ne555BaselineExtraction.packageSelection,
      selectedPackage: changes.selectedPackage ?? ne555BaselineExtraction.packageSelection.selectedPackage,
    },
    pinRows: changes.pinRows ?? ne555Pins,
    providerMeta: meta,
    review: { needsReview: false, notes: [] },
  };

  const detail = buildDetail({
    comparison: {
      agreement: null,
      baseline: {
        model: ne555BaselineFixture.providerMeta.model,
        partNumber: "NE555DR",
        reviewStatus: ne555BaselineFixture.reviewStatus,
        submissionId: ne555BaselineFixture.submissionId,
      },
      baselineSubmissionId: ne555BaselineFixture.submissionId,
    },
    createdAt,
    extraction,
    intake: ne555BaselineFixture.intake,
    review: review ? review(extraction) : createDefaultSubmissionReview(extraction),
    submissionId,
  });

  return {
    ...detail,
    comparison: {
      ...detail.comparison!,
      agreement: computeSubmissionAgreement(ne555BaselineFixture, extraction),
    },
  };
}

/** The 8-pin re-run page fixture: Sol · Medium, 84% agreement, partly reviewed. */
export const rerunFixture: SubmissionDetail = ne555Rerun(
  "fx-ne555-rerun-sol",
  "2026-09-21T11:04:31.000Z",
  providerMeta("gpt-5.6-sol", "medium", 19_012, 0.074, { input: 114_702, output: 777, reasoning: 268 }),
  {
    fields: {
      "Pin Length": { confidence: "medium", value: "1.04 mm" },
      "Pin Pitch": { evidencePages: [30, 31], value: "1.27 mm BSC" },
      "Stand Off": { value: "0.10 mm to 0.25 mm" },
    },
    pinRows: [...ne555Pins.slice(0, 7), pin("8", "VCC+", [3], "medium")],
    selectedPackage: "D (SOIC, 8)-pin, D0008A",
  },
  (extraction) => {
    const review = createDefaultSubmissionReview(extraction);

    return {
      ...review,
      measurements: review.measurements.map((entry, index) =>
        index < 3 ? { ...entry, status: "confirmed" as const } : entry,
      ),
      pins: review.pins.map((entry) =>
        entry.pinIndex < 2
          ? { ...entry, status: "confirmed" as const }
          : entry.pinIndex === 7
            ? {
                correctedPinName: "VCC",
                correctedPinNumber: "8",
                correctionNote: "Pinout table on page 3 lists VCC",
                pinIndex: entry.pinIndex,
                status: "corrected" as const,
              }
            : entry,
      ),
    };
  },
);

const ne555OtherRuns: SubmissionDetail[] = [
  ne555Rerun(
    "fx-ne555-rerun-terra-medium",
    "2026-09-21T11:03:12.000Z",
    providerMeta("gpt-5.6-terra", "medium", 18_640, 0.239, { input: 114_702, output: 792, reasoning: 274 }),
    { selectedPackage: "D (SOIC, 8)-pin, D0008A" },
  ),
  ne555Rerun(
    "fx-ne555-rerun-gpt54-medium",
    "2026-09-21T11:24:40.000Z",
    providerMeta("gpt-5.4", "medium", 18_910, 0.093, { input: 96_310, output: 1_096, reasoning: 512 }),
    { fields: { "Pin Length": { value: "1.04 mm" }, "Height": { value: "1.75 mm" } } },
  ),
  ne555Rerun(
    "fx-ne555-rerun-terra-high",
    "2026-09-21T11:24:52.000Z",
    providerMeta("gpt-5.6-terra", "high", 23_200, 0.245, { input: 114_702, output: 1_323, reasoning: 615 }),
    { fields: { "Pin Length": { value: "0.41 mm to 1.27 mm" } } },
  ),
];

export const ne555RunsFixture: SubmissionModelRun[] = [
  toModelRun(ne555BaselineFixture, null),
  ...[ne555OtherRuns[0], rerunFixture, ...ne555OtherRuns.slice(1)]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((detail) => toModelRun(detail, ne555BaselineFixture)),
];

/* -------------------- 3. CY8C5668AXI-LP010, 108 pins ------------------------ */

const SPECIAL_PINS: Record<number, string> = {
  1: "P2[5]",
  9: "VSSB",
  10: "IND",
  11: "VBOOST",
  12: "VBAT",
  13: "VSSD",
  14: "XRES",
  20: "VDDIO5",
  25: "VCCD",
  26: "VSSD",
  27: "VDDD",
  37: "VDDIO1",
  38: "P12[4], SIO",
  39: "P12[5], SIO",
  40: "VSSA",
  48: "VDDIO0",
  50: "VDDA",
  51: "VSSA",
  52: "VCCA",
  63: "VDDIO3",
  74: "VDDD",
  75: "VSSD",
  76: "VCCD",
  88: "VDDIO2",
  89: "P2[0]",
  100: "P2[4]",
};

function cyPinName(number: number) {
  if (SPECIAL_PINS[number]) {
    return SPECIAL_PINS[number];
  }

  const ports = [2, 12, 3, 4, 15, 1, 5, 6, 0];
  const port = ports[Math.floor(number / 12) % ports.length];
  const bit = number % 8;
  const suffix =
    port === 1 && bit < 4
      ? [", SWDIO, TMS", ", SWDCK, TCK", ", TDO, SWV", ", TDI"][bit]
      : port === 15 && bit < 2
        ? [", EXTREF0", ", EXTREF1"][bit]
        : "";

  return `P${port}[${bit}]${suffix}`;
}

function cyPinPage(number: number) {
  return 9 + Math.floor((number - 1) / 25);
}

const largePins: PinRow[] = [
  ...Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    const confidence: ConfidenceLevel =
      number % 23 === 0 ? "low" : number % 9 === 0 ? "medium" : "high";

    return pin(String(number), cyPinName(number), number === 57 || number === 58 ? [] : [cyPinPage(number)], confidence);
  }),
  // Rows the AI listed twice (duplicate pin numbers) or from the ordering table.
  pin("13", "VSSD", [13], "medium"),
  pin("26", "VSSD", [13], "medium"),
  pin("75", "VSSD", [13]),
  pin("27", "VDDD", [13]),
  pin("74", "VDDD", [13]),
  pin("50", "VDDA", [13], "low"),
  pin("EP", "Exposed pad, VSS", [], "medium"),
  pin("NC", "No connect", []),
];

const largeExtraction: ExtractionSnapshot = {
  fields: [
    measurement("Body Length", "13.80 mm to 14.20 mm", "high", [112]),
    measurement("Body Width", "13.80 mm to 14.20 mm", "high", [112]),
    measurement("Height", "1.20 mm max", "high", [112]),
    measurement("Left/Right Pins", "25", "high", [9, 112]),
    measurement("Pin Length", "0.45 mm to 0.75 mm", "medium", [112]),
    measurement("Pin Pitch", "0.50 mm", "high", [112]),
    measurement("Pin Span 1", "15.80 mm to 16.20 mm", "high", [112]),
    measurement("Pin Span 2", "15.80 mm to 16.20 mm", "medium", [112]),
    measurement("Pin Width", "0.17 mm to 0.27 mm", "high", [112]),
    measurement("Stand Off", "0.05 mm to 0.15 mm", "low", [112], "Needs review"),
    measurement("Thermal Pad Length", "", "high", [], "Not found"),
    measurement("Thermal Pad Width", "", "high", [], "Not found"),
    measurement("Top/Bottom Pins", "25", "high", []),
  ],
  packageSelection: {
    alternatives: ["100-pin TQFP (14 × 14 × 1.0 mm)", "51-85048"],
    confidence: "medium",
    selectedPackage: "100-TQFP (14 × 14 × 1.4 mm), 51-85050",
  },
  pinRows: largePins,
  providerMeta: providerMeta("gpt-5.6-terra", "high", 48_310, 0.412, { input: 402_118, output: 9_840, reasoning: 3_210 }),
  review: {
    needsReview: true,
    notes: [
      "Two package drawings appear (pages 112 and 113); the 1.4 mm body thickness drawing was used.",
      "Pins 13, 26 and 75 are all listed as VSSD in the pinout table on page 13.",
      "Stand-off is only given as a range in the note on page 112 and may be for the thinner package.",
    ],
  },
};

export const largeBaselineFixture: SubmissionDetail = buildDetail({
  createdAt: "2026-09-24T16:40:05.000Z",
  extraction: largeExtraction,
  intake: {
    packageCategory: "Quad Flat Packages",
    partNumber: "CY8C5668AXI-LP010",
    requestedFields: largeExtraction.fields.map((field) => field.field),
    sourceLabel: "PSoC5LP_CY8C56LP_datasheet.pdf",
    sourceMeta: {
      checksumSha256: "4b1e0f5c2d8a7e6b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
      fileName: "PSoC5LP_CY8C56LP_datasheet.pdf",
      kind: "upload",
      mimeType: "application/pdf",
      objectKey: "datasheets/uploads/2026/09/24/psoc5lp-cy8c56lp.pdf",
      sizeBytes: 4_912_640,
      storageProvider: "cloudflare-r2",
    },
    sourceMode: "upload",
  },
  review: createDefaultSubmissionReview(largeExtraction),
  submissionId: "fx-cy8c5668-baseline",
});

function largeRerun(
  submissionId: string,
  createdAt: string,
  meta: ProviderMeta,
  renamePins: Record<number, string>,
  fields: Record<string, string>,
): SubmissionDetail {
  const extraction: ExtractionSnapshot = {
    ...largeExtraction,
    fields: largeExtraction.fields.map((field) =>
      fields[field.field] ? { ...field, status: "Extracted", value: fields[field.field] } : field,
    ),
    pinRows: largePins.map((row, index) =>
      renamePins[index] ? { ...row, pinName: renamePins[index] } : row,
    ),
    providerMeta: meta,
    review: { needsReview: false, notes: [] },
  };
  const detail = buildDetail({
    comparison: {
      agreement: computeSubmissionAgreement(largeBaselineFixture, extraction),
      baseline: {
        model: largeBaselineFixture.providerMeta.model,
        partNumber: "CY8C5668AXI-LP010",
        reviewStatus: largeBaselineFixture.reviewStatus,
        submissionId: largeBaselineFixture.submissionId,
      },
      baselineSubmissionId: largeBaselineFixture.submissionId,
    },
    createdAt,
    extraction,
    intake: largeBaselineFixture.intake,
    review: createDefaultSubmissionReview(extraction),
    submissionId,
  });

  return detail;
}

const largeReruns = [
  largeRerun(
    "fx-cy8c5668-rerun-astra",
    "2026-09-24T17:02:44.000Z",
    providerMeta("gpt-6-astra", "high", 61_020, 0.96, { input: 402_118, output: 11_204, reasoning: 5_880 }),
    { 10: "IND, VBOOST", 37: "P12[4]", 38: "P12[5]", 99: "P2[3]" },
    { "Stand Off": "0.05 mm to 0.15 mm", "Pin Span 2": "16.00 mm BSC" },
  ),
  largeRerun(
    "fx-cy8c5668-rerun-sol",
    "2026-09-24T17:05:10.000Z",
    providerMeta("gpt-5.6-sol", "high", 39_880, 0.188, { input: 402_118, output: 8_730, reasoning: 2_144 }),
    { 10: "IND", 37: "P12[4]", 61: "P6[2]" },
    { "Stand Off": "0.05 mm min", "Height": "1.60 mm max" },
  ),
];

export const largeRunsFixture: SubmissionModelRun[] = [
  toModelRun(largeBaselineFixture, null),
  ...largeReruns.map((detail) => toModelRun(detail, largeBaselineFixture)),
];
