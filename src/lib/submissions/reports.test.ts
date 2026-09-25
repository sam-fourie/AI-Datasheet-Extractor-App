import { describe, expect, it } from "vitest";

import { summarizeModelRuns } from "@/lib/submissions/model-stats";
import {
  buildAccuracyDistribution,
  buildAgreementMatrix,
  buildCostAgreementPoints,
  buildFieldCorrectionStats,
  buildReports,
  buildReportsFilterOptions,
  buildReportsOverview,
  DEFAULT_REPORTS_QUERY,
  filterReportSubmissions,
  parseReportsQuery,
  serializeReportsQuery,
  sortLeaderboard,
} from "@/lib/submissions/reports";
import type {
  ReportSubmission,
  ReviewDecisionStatus,
  SubmissionAgreement,
} from "@/lib/submissions/types";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const BASELINE_A = "a".repeat(24);
const BASELINE_B = "b".repeat(24);
const BASELINE_C = "c".repeat(24);

function agreement(
  agreementPercentage: number,
  overrides: Partial<SubmissionAgreement> = {},
): SubmissionAgreement {
  return {
    agreementPercentage,
    basis: "reviewed",
    baselineReviewStatus: "reviewed",
    baselineReviewedDecisions: 10,
    baselineTotalDecisions: 10,
    compared: 10,
    matches: 0,
    mismatches: 0,
    partialMatches: 0,
    rows: [],
    ...overrides,
  };
}

type SubmissionInput = {
  agreement?: SubmissionAgreement | null;
  category?: ReportSubmission["intake"]["packageCategory"];
  confirmed?: number;
  corrected?: number;
  costUsd?: number;
  createdAt?: string;
  effort?: string;
  id: string;
  latencyMs?: number;
  measurementDecisions?: Array<{ field: string; status: ReviewDecisionStatus }>;
  model?: string;
  packageDecision?: ReviewDecisionStatus;
  partNumber?: string;
  pending?: number;
  pinCounts?: { confirmed: number; corrected: number; pending: number };
  root?: string;
};

function submission(input: SubmissionInput): ReportSubmission {
  const confirmed = input.confirmed ?? 0;
  const corrected = input.corrected ?? 0;
  const pending = input.pending ?? 0;
  const pinCounts = input.pinCounts ?? { confirmed: 0, corrected: 0, pending: 0 };
  const isBaseline = input.root === undefined || input.root === input.id;
  const root = input.root ?? input.id;

  return {
    comparison: isBaseline
      ? undefined
      : { agreement: input.agreement ?? null, baseline: null, baselineSubmissionId: root },
    createdAt: input.createdAt ?? "2026-09-20T00:00:00.000Z",
    intake: {
      packageCategory: input.category ?? "Small Outline Packages",
      partNumber: input.partNumber ?? "NE555DR",
      requestedFields: [],
      sourceLabel: "se555.pdf",
      sourceMeta: {
        checksumSha256: "x",
        fileName: "se555.pdf",
        kind: "upload",
        mimeType: "application/pdf",
        sizeBytes: 1,
      },
      sourceMode: "upload",
    },
    isBaseline,
    measurementDecisions: input.measurementDecisions ?? [],
    packageDecision: input.packageDecision ?? "pending",
    pinDecisionCounts: { ...pinCounts, total: pinCounts.confirmed + pinCounts.corrected + pinCounts.pending },
    providerMeta: {
      estimatedCostUsd: input.costUsd,
      latencyMs: input.latencyMs,
      model: input.model ?? "gpt-5.4",
      provider: "openai",
      reasoningEffort: input.effort ?? "high",
    },
    reviewDecisionCounts: { confirmed, corrected, pending, total: confirmed + corrected + pending },
    reviewStatus: pending === 0 && confirmed + corrected > 0 ? "reviewed" : "pending",
    reviewedAt: null,
    rootSubmissionId: root,
    submissionId: input.id,
    updatedAt: input.createdAt ?? "2026-09-20T00:00:00.000Z",
  };
}

// Baseline A (reviewed, 90%) with three runs; baseline B (reviewed, 70%) with one;
// baseline C pending with one unscored run.
const fixtures: ReportSubmission[] = [
  submission({
    confirmed: 9,
    corrected: 1,
    costUsd: 0.1,
    createdAt: "2026-06-01T00:00:00.000Z",
    id: BASELINE_A,
    latencyMs: 20_000,
    measurementDecisions: [
      { field: "Body Length", status: "confirmed" },
      { field: "Body Width", status: "corrected" },
      { field: "Height", status: "confirmed" },
    ],
    packageDecision: "confirmed",
    partNumber: "NE555DR",
    pinCounts: { confirmed: 6, corrected: 0, pending: 0 },
  }),
  submission({
    agreement: agreement(96),
    costUsd: 0.2,
    createdAt: "2026-09-10T00:00:00.000Z",
    id: "a1",
    latencyMs: 30_000,
    model: "gpt-5.6-terra",
    root: BASELINE_A,
  }),
  submission({
    agreement: agreement(84),
    costUsd: 0.4,
    createdAt: "2026-09-22T00:00:00.000Z",
    id: "a2",
    latencyMs: 40_000,
    model: "gpt-5.6-sol",
    root: BASELINE_A,
  }),
  submission({
    agreement: agreement(88),
    costUsd: 0.24,
    createdAt: "2026-09-23T00:00:00.000Z",
    id: "a3",
    latencyMs: 10_000,
    model: "gpt-5.6-terra",
    root: BASELINE_A,
  }),
  submission({
    category: "Quad Flat No-Lead",
    confirmed: 7,
    corrected: 3,
    costUsd: 0.1,
    createdAt: "2026-09-01T00:00:00.000Z",
    id: BASELINE_B,
    measurementDecisions: [
      { field: "Body Length", status: "corrected" },
      { field: "Body Width", status: "corrected" },
      { field: "Pin Pitch", status: "confirmed" },
    ],
    packageDecision: "corrected",
    partNumber: "TPS62130",
    pinCounts: { confirmed: 2, corrected: 2, pending: 0 },
  }),
  submission({
    agreement: agreement(70),
    category: "Quad Flat No-Lead",
    confirmed: 10,
    createdAt: "2026-09-02T00:00:00.000Z",
    id: "b1",
    model: "gpt-5.6-terra",
    partNumber: "TPS62130",
    root: BASELINE_B,
  }),
  submission({
    category: "BGA",
    confirmed: 1,
    createdAt: "2026-09-24T00:00:00.000Z",
    id: BASELINE_C,
    partNumber: "CY8C5668",
    pending: 5,
  }),
  submission({
    agreement: agreement(40, { basis: "unreviewed", baselineReviewStatus: "pending" }),
    category: "BGA",
    createdAt: "2026-09-24T01:00:00.000Z",
    id: "c1",
    model: "gpt-5.6-terra",
    partNumber: "CY8C5668",
    root: BASELINE_C,
  }),
];

describe("parseReportsQuery and serializeReportsQuery", () => {
  it("defaults", () => {
    expect(parseReportsQuery({})).toEqual(DEFAULT_REPORTS_QUERY);
    expect(serializeReportsQuery(DEFAULT_REPORTS_QUERY)).toBe("");
  });

  it("validates values", () => {
    expect(
      parseReportsQuery({
        category: "Nope",
        datasheet: "not-an-id",
        dir: "sideways",
        effort: "turbo",
        range: "7d",
        sort: "vibes",
      }),
    ).toEqual(DEFAULT_REPORTS_QUERY);
  });

  it("defaults the direction per sort key and round-trips", () => {
    const query = parseReportsQuery({
      category: "BGA",
      datasheet: BASELINE_A.toUpperCase(),
      effort: "high",
      model: "gpt-5.6-terra",
      range: "30d",
      sort: "cost",
    });

    expect(query).toEqual({
      category: "BGA",
      datasheet: BASELINE_A,
      dir: "asc",
      effort: "high",
      model: "gpt-5.6-terra",
      range: "30d",
      sort: "cost",
    });
    expect(serializeReportsQuery(query)).toBe(
      `range=30d&model=gpt-5.6-terra&effort=high&category=BGA&datasheet=${BASELINE_A}&sort=cost`,
    );
    expect(
      parseReportsQuery(Object.fromEntries(new URLSearchParams(serializeReportsQuery(query)))),
    ).toEqual(query);
    expect(serializeReportsQuery({ dir: "asc" })).toBe("dir=asc");
  });
});

describe("filterReportSubmissions", () => {
  it("filters by range, model, effort, category and datasheet", () => {
    const ids = (scope: Parameters<typeof filterReportSubmissions>[1]) =>
      filterReportSubmissions(fixtures, scope, NOW).map((entry) => entry.submissionId);

    expect(ids({ range: "30d" })).toEqual(["a1", "a2", "a3", BASELINE_B, "b1", BASELINE_C, "c1"]);
    expect(ids({ range: "90d" })).not.toContain(BASELINE_A);
    expect(ids({ model: "gpt-5.6-sol" })).toEqual(["a2"]);
    expect(ids({ effort: "low" })).toEqual([]);
    expect(ids({ category: "Quad Flat No-Lead" })).toEqual([BASELINE_B, "b1"]);
    expect(ids({ datasheet: BASELINE_A })).toEqual([BASELINE_A, "a1", "a2", "a3"]);
    expect(ids({})).toHaveLength(fixtures.length);
  });
});

describe("buildReportsOverview", () => {
  it("summarizes the scope", () => {
    expect(buildReportsOverview(fixtures)).toEqual({
      accuracySubmissions: 3,
      averageAccuracy: 87,
      averageAgreement: 85,
      baselineRuns: 3,
      costRuns: 5,
      estimatedSpendUsd: 1.04,
      rerunRuns: 5,
      reviewedDatasheets: 2,
      scoredRuns: 4,
      totalRuns: 8,
    });
  });

  it("is empty for no submissions", () => {
    expect(buildReportsOverview([])).toMatchObject({
      averageAccuracy: null,
      averageAgreement: null,
      estimatedSpendUsd: null,
      totalRuns: 0,
    });
  });
});

describe("buildAccuracyDistribution", () => {
  it("buckets reviewed submissions with the score bands", () => {
    const distribution = buildAccuracyDistribution(fixtures);

    expect(distribution.total).toBe(3);
    expect(distribution.bands.map((band) => [band.tone, band.min, band.max, band.count])).toEqual([
      ["success", 95, 100, 1],
      ["warning", 80, 94, 1],
      ["danger", 0, 79, 1],
    ]);
    expect(distribution.bands[0].items[0]).toMatchObject({
      accuracy: 100,
      isBaseline: false,
      partNumber: "TPS62130",
      runLabel: "Terra · High",
      submissionId: "b1",
    });
  });
});

describe("leaderboard and cost vs agreement", () => {
  const stats = summarizeModelRuns(fixtures);

  it("builds points only for scored model·efforts with cost data", () => {
    const chart = buildCostAgreementPoints(stats, {
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
    });

    expect(chart.points.map((point) => [point.label, point.averageAgreement, point.isDefault])).toEqual([
      ["Terra · High", 85, true],
      ["Sol · High", 84, false],
    ]);
    expect(chart.xMax).toBeCloseTo(0.4 * 1.15);
    expect(chart.xTicks).toHaveLength(4);
    expect(chart.yMin).toBe(60);
    expect(chart.yTicks).toEqual([60, 70, 80, 90, 100]);
  });

  it("drops the y floor below 60 for low agreement", () => {
    const chart = buildCostAgreementPoints(
      summarizeModelRuns([
        submission({ agreement: agreement(42), costUsd: 0.1, id: "x", model: "gpt-5.6-luna", root: BASELINE_A }),
      ]),
    );

    expect(chart.yMin).toBe(40);
    expect(chart.points[0].isDefault).toBe(false);
  });

  it("is empty without scored runs", () => {
    expect(buildCostAgreementPoints([]).points).toEqual([]);
  });

  it("sorts with nulls last and a per-key default direction", () => {
    const byAgreement = sortLeaderboard(stats).map((stat) => stat.model);
    const byLatency = sortLeaderboard(stats, "latency").map((stat) => stat.model);
    const byRunsAsc = sortLeaderboard(stats, "runs", "asc").map((stat) => stat.model);

    expect(byAgreement).toEqual(["gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.4"]);
    expect(byLatency).toEqual(["gpt-5.6-terra", "gpt-5.4", "gpt-5.6-sol"]);
    expect(byRunsAsc).toEqual(["gpt-5.6-sol", "gpt-5.4", "gpt-5.6-terra"]);
    expect(sortLeaderboard(stats, "agreement", "asc").at(-1)?.model).toBe("gpt-5.4");
  });
});

describe("buildAgreementMatrix", () => {
  it("has reviewed baselines with runs as rows and model·efforts as columns", () => {
    const matrix = buildAgreementMatrix(fixtures);

    expect(matrix.columns.map((column) => column.label)).toEqual([
      "Terra · High",
      "Sol · High",
      "GPT-5.4 · High",
    ]);
    expect(matrix.rows.map((row) => row.partNumber)).toEqual(["NE555DR", "TPS62130"]);

    const [ne555] = matrix.rows;

    expect(ne555.cells[0]).toMatchObject({
      agreement: 92,
      isBaseline: false,
      latestAgreement: 88,
      latestSubmissionId: "a3",
      runCount: 2,
      scoredRuns: 2,
    });
    expect(ne555.cells[1]).toMatchObject({ agreement: 84, latestSubmissionId: "a2", runCount: 1 });
    expect(ne555.cells[2]).toMatchObject({ isBaseline: true, runCount: 0 });
  });

  it("finds baselines outside the filtered scope through the pool", () => {
    const solOnly = filterReportSubmissions(fixtures, { model: "gpt-5.6-sol" }, NOW);

    expect(buildAgreementMatrix(solOnly).rows).toEqual([]);

    const matrix = buildAgreementMatrix(solOnly, fixtures);

    expect(matrix.rows).toHaveLength(1);
    expect(matrix.columns.map((column) => column.label)).toEqual(["Sol · High", "GPT-5.4 · High"]);
  });
});

describe("buildFieldCorrectionStats", () => {
  it("ranks fields by correction rate across fully reviewed submissions", () => {
    const report = buildFieldCorrectionStats(fixtures);

    expect(report.reviewedSubmissions).toBe(3);
    expect(report.fields.map((field) => [field.label, field.corrected, field.decided, field.correctionRate])).toEqual([
      ["Body Width", 2, 2, 100],
      ["Body Length", 1, 2, 50],
    ]);
    expect(report.excludedFieldCount).toBe(2);
    expect(report.pins).toMatchObject({ corrected: 2, decided: 10, correctionRate: 20 });
    expect(report.package).toMatchObject({ corrected: 1, decided: 2, correctionRate: 50 });
  });

  it("is empty without reviewed submissions", () => {
    expect(buildFieldCorrectionStats([])).toEqual({
      excludedFieldCount: 0,
      fields: [],
      package: null,
      pins: null,
      reviewedSubmissions: 0,
    });
  });
});

describe("buildReports", () => {
  it("builds every section from one scope and uses summarizeModelRuns for the leaderboard", () => {
    const query = parseReportsQuery({ datasheet: BASELINE_A });
    const reports = buildReports(fixtures, query, { now: NOW });
    const inScope = filterReportSubmissions(fixtures, query, NOW);

    expect(reports.inScope).toEqual(inScope);
    expect(reports.datasheet).toEqual({ partNumber: "NE555DR", submissionId: BASELINE_A });
    expect(reports.overview.totalRuns).toBe(4);
    expect(reports.agreementMatrix.rows).toHaveLength(1);
    expect(new Set(reports.leaderboard)).toEqual(new Set(summarizeModelRuns(inScope)));
    expect(reports.filterOptions).toEqual(buildReportsFilterOptions(fixtures));
  });

  it("lists filter options present in the data", () => {
    expect(buildReportsFilterOptions(fixtures)).toEqual({
      categories: ["BGA", "Quad Flat No-Lead", "Small Outline Packages"],
      efforts: ["high"],
      models: ["gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.4"],
    });
  });
});
