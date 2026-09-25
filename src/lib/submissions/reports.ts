import {
  OPENAI_MODEL_IDS,
  OPENAI_REASONING_EFFORTS,
  isOpenAIReasoningEffort,
} from "@/lib/ai/models";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import type { PackageCategory } from "@/lib/package-categories";
import { isScoredAgreement } from "@/lib/submissions/agreement";
import {
  firstSearchParam,
  isPackageCategory,
  type SearchParamsRecord,
} from "@/lib/submissions/list-query";
import {
  type ModelRunStats,
  sortModelIds,
  summarizeModelRuns,
} from "@/lib/submissions/model-stats";
import {
  deriveSubmissionAccuracyPercentage,
  measurementRowKey,
} from "@/lib/submissions/review";
import { SCORE_BANDS, type ScoreTone, scoreTone } from "@/lib/submissions/score";
import type { ReportSubmission } from "@/lib/submissions/types";

/**
 * Pure aggregates for /reports. The page loads `listReportSubmissions()`,
 * parses the URL with `parseReportsQuery` and calls `buildReports`. Model
 * aggregates always come from `summarizeModelRuns`, and every agreement
 * number counts only runs scored against a fully reviewed baseline
 * (`isScoredAgreement`).
 */

/* --------------------------------- Query ---------------------------------- */

export const REPORTS_RANGES = ["30d", "90d", "all"] as const;
export type ReportsRange = (typeof REPORTS_RANGES)[number];

export const LEADERBOARD_SORT_KEYS = [
  "agreement",
  "accuracy",
  "latency",
  "cost",
  "runs",
] as const;
export type LeaderboardSortKey = (typeof LEADERBOARD_SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";

export type ReportsQuery = {
  category: PackageCategory | null;
  /** Root (baseline) submission id: the baseline plus its runs. */
  datasheet: string | null;
  dir: SortDirection;
  effort: string | null;
  model: string | null;
  range: ReportsRange;
  sort: LeaderboardSortKey;
};

export type ReportsScope = Pick<
  ReportsQuery,
  "category" | "datasheet" | "effort" | "model" | "range"
>;

export const DEFAULT_REPORTS_QUERY: ReportsQuery = {
  category: null,
  datasheet: null,
  dir: "desc",
  effort: null,
  model: null,
  range: "all",
  sort: "agreement",
};

const RANGE_DAYS: Record<Exclude<ReportsRange, "all">, number> = {
  "30d": 30,
  "90d": 90,
};

const DAY_MS = 86_400_000;
const SUBMISSION_ID_PATTERN = /^[a-f\d]{24}$/i;
const MAX_MODEL_LENGTH = 100;

/** Lower is better for latency and cost, so they default to ascending. */
export function defaultSortDirection(sort: LeaderboardSortKey): SortDirection {
  return sort === "latency" || sort === "cost" ? "asc" : "desc";
}

function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function parseReportsQuery(searchParams: SearchParamsRecord): ReportsQuery {
  const model = firstSearchParam(searchParams.model)?.trim() ?? "";
  const effort = firstSearchParam(searchParams.effort)?.trim() ?? "";
  const category = firstSearchParam(searchParams.category)?.trim() ?? "";
  const datasheet = firstSearchParam(searchParams.datasheet)?.trim() ?? "";
  const sort =
    pickEnum(firstSearchParam(searchParams.sort), LEADERBOARD_SORT_KEYS) ??
    DEFAULT_REPORTS_QUERY.sort;

  return {
    category: isPackageCategory(category) ? category : null,
    datasheet: SUBMISSION_ID_PATTERN.test(datasheet) ? datasheet.toLowerCase() : null,
    dir:
      pickEnum(firstSearchParam(searchParams.dir), ["asc", "desc"] as const) ??
      defaultSortDirection(sort),
    effort: isOpenAIReasoningEffort(effort) ? effort : null,
    model: model.length > 0 && model.length <= MAX_MODEL_LENGTH ? model : null,
    range:
      pickEnum(firstSearchParam(searchParams.range), REPORTS_RANGES) ??
      DEFAULT_REPORTS_QUERY.range,
    sort,
  };
}

/**
 * Query string without the leading "?", omitting defaults. Keys appear in a
 * fixed order: range, model, effort, category, datasheet, sort, dir.
 */
export function serializeReportsQuery(query: Partial<ReportsQuery>): string {
  const params = new URLSearchParams();
  const sort = query.sort ?? DEFAULT_REPORTS_QUERY.sort;

  if (query.range && query.range !== DEFAULT_REPORTS_QUERY.range) {
    params.set("range", query.range);
  }

  if (query.model) {
    params.set("model", query.model);
  }

  if (query.effort) {
    params.set("effort", query.effort);
  }

  if (query.category) {
    params.set("category", query.category);
  }

  if (query.datasheet) {
    params.set("datasheet", query.datasheet);
  }

  if (sort !== DEFAULT_REPORTS_QUERY.sort) {
    params.set("sort", sort);
  }

  if (query.dir && query.dir !== defaultSortDirection(sort)) {
    params.set("dir", query.dir);
  }

  return params.toString();
}

/** Applies range (by createdAt), model, effort, category and datasheet. */
export function filterReportSubmissions(
  submissions: readonly ReportSubmission[],
  scope: Partial<ReportsScope>,
  now: Date = new Date(),
): ReportSubmission[] {
  const range = scope.range ?? "all";
  const since = range === "all" ? null : now.getTime() - RANGE_DAYS[range] * DAY_MS;

  return submissions.filter((submission) => {
    if (since !== null) {
      const createdAt = Date.parse(submission.createdAt);

      if (!Number.isFinite(createdAt) || createdAt < since) {
        return false;
      }
    }

    if (scope.model && submission.providerMeta.model !== scope.model) {
      return false;
    }

    if (scope.effort && submission.providerMeta.reasoningEffort !== scope.effort) {
      return false;
    }

    if (scope.category && submission.intake.packageCategory !== scope.category) {
      return false;
    }

    if (scope.datasheet && submission.rootSubmissionId !== scope.datasheet) {
      return false;
    }

    return true;
  });
}

/* -------------------------------- Helpers --------------------------------- */

function mean(values: readonly number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function roundOrNull(value: number | null, fractionDigits = 0) {
  if (value === null) {
    return null;
  }

  const factor = 10 ** fractionDigits;

  return Math.round(value * factor) / factor;
}

function accuracyOf(submission: ReportSubmission) {
  return deriveSubmissionAccuracyPercentage(submission);
}

function scoredAgreementOf(submission: ReportSubmission) {
  const agreement = submission.comparison?.agreement;

  return isScoredAgreement(agreement) ? agreement.agreementPercentage : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function orderIndex(list: readonly string[], value: string | null) {
  if (value === null) {
    return list.length + 1;
  }

  const index = list.indexOf(value);

  return index === -1 ? list.length : index;
}

/** Same grouping key as summarizeModelRuns: "model::effort". */
export function modelEffortKey(providerMeta: { model: string; reasoningEffort?: string }) {
  return `${providerMeta.model}::${providerMeta.reasoningEffort ?? ""}`;
}

/* -------------------------------- Overview -------------------------------- */

export type ReportsOverview = {
  /** Reviewed accuracy averaged over every reviewed submission in scope. */
  averageAccuracy: number | null;
  /** Scored agreement averaged over runs vs fully reviewed baselines. */
  averageAgreement: number | null;
  /** Number of reviewed submissions behind averageAccuracy. */
  accuracySubmissions: number;
  baselineRuns: number;
  /** Runs with cost data behind estimatedSpendUsd. */
  costRuns: number;
  estimatedSpendUsd: number | null;
  rerunRuns: number;
  /** Reviewed baselines ("Reviewed datasheets"). */
  reviewedDatasheets: number;
  /** Number of scored runs behind averageAgreement. */
  scoredRuns: number;
  totalRuns: number;
};

export function buildReportsOverview(submissions: readonly ReportSubmission[]): ReportsOverview {
  const baselines = submissions.filter((submission) => submission.isBaseline);
  const accuracies = submissions
    .map(accuracyOf)
    .filter((value): value is number => value !== null);
  const agreements = submissions
    .map(scoredAgreementOf)
    .filter((value): value is number => value !== null);
  const costs = submissions
    .map((submission) => submission.providerMeta.estimatedCostUsd)
    .filter(isFiniteNumber);

  return {
    accuracySubmissions: accuracies.length,
    averageAccuracy: roundOrNull(mean(accuracies)),
    averageAgreement: roundOrNull(mean(agreements)),
    baselineRuns: baselines.length,
    costRuns: costs.length,
    estimatedSpendUsd:
      costs.length > 0 ? roundOrNull(costs.reduce((sum, value) => sum + value, 0), 4) : null,
    rerunRuns: submissions.length - baselines.length,
    reviewedDatasheets: baselines.filter((submission) => submission.reviewStatus === "reviewed")
      .length,
    scoredRuns: agreements.length,
    totalRuns: submissions.length,
  };
}

/* ------------------------- Accuracy distribution -------------------------- */

export type AccuracyDistributionItem = {
  accuracy: number;
  isBaseline: boolean;
  partNumber: string;
  runLabel: string;
  submissionId: string;
};

export type AccuracyDistributionBand = {
  count: number;
  items: AccuracyDistributionItem[];
  label: string;
  max: number;
  min: number;
  tone: Exclude<ScoreTone, "neutral">;
};

export type AccuracyDistribution = {
  /** One band per SCORE_BANDS entry, best first. */
  bands: AccuracyDistributionBand[];
  total: number;
};

export function buildAccuracyDistribution(
  submissions: readonly ReportSubmission[],
): AccuracyDistribution {
  const bands: AccuracyDistributionBand[] = SCORE_BANDS.map((band, index) => ({
    count: 0,
    items: [],
    label: band.label,
    max: index === 0 ? 100 : SCORE_BANDS[index - 1].min - 1,
    min: band.min,
    tone: band.tone,
  }));
  let total = 0;

  for (const submission of submissions) {
    const accuracy = accuracyOf(submission);

    if (accuracy === null) {
      continue;
    }

    const tone = scoreTone(accuracy);
    const band = bands.find((candidate) => candidate.tone === tone);

    if (!band) {
      continue;
    }

    band.items.push({
      accuracy,
      isBaseline: submission.isBaseline,
      partNumber: submission.intake.partNumber,
      runLabel: formatRunLabel(submission.providerMeta),
      submissionId: submission.submissionId,
    });
    band.count += 1;
    total += 1;
  }

  for (const band of bands) {
    band.items.sort(
      (left, right) =>
        right.accuracy - left.accuracy || left.partNumber.localeCompare(right.partNumber),
    );
  }

  return { bands, total };
}

/* ---------------------------- Cost vs agreement --------------------------- */

export type ModelEffortDefaults = {
  model: string;
  reasoningEffort: string | null;
};

export type CostAgreementPoint = {
  agreementRuns: number;
  averageAgreement: number;
  averageCostUsd: number;
  costRuns: number;
  isDefault: boolean;
  key: string;
  /** "Terra · High" */
  label: string;
  model: string;
  reasoningEffort: string | null;
};

export type CostAgreementChart = {
  points: CostAgreementPoint[];
  /** 4 evenly spaced ticks from 0 to xMax. */
  xTicks: number[];
  /** Max average cost × 1.15 (0 when there are no points). */
  xMax: number;
  /** min(60, floor10(min agreement)). */
  yMin: number;
  /** Every 10 from yMin to 100. */
  yTicks: number[];
};

/**
 * One point per model·effort with at least one scored agreement run and cost
 * data. Pass the output of summarizeModelRuns for the filtered scope.
 */
export function buildCostAgreementPoints(
  stats: readonly ModelRunStats[],
  defaults?: ModelEffortDefaults | null,
): CostAgreementChart {
  const points: CostAgreementPoint[] = stats
    .filter(
      (stat) =>
        stat.agreementRuns > 0 && stat.averageAgreement !== null && stat.averageCostUsd !== null,
    )
    .map((stat) => ({
      agreementRuns: stat.agreementRuns,
      averageAgreement: stat.averageAgreement as number,
      averageCostUsd: stat.averageCostUsd as number,
      costRuns: stat.costRuns,
      isDefault:
        defaults !== null &&
        defaults !== undefined &&
        stat.model === defaults.model &&
        (stat.reasoningEffort ?? null) === (defaults.reasoningEffort ?? null),
      key: stat.key,
      label: formatRunLabel({
        model: stat.model,
        reasoningEffort: stat.reasoningEffort ?? undefined,
      }),
      model: stat.model,
      reasoningEffort: stat.reasoningEffort,
    }));

  const maxCost = points.reduce((max, point) => Math.max(max, point.averageCostUsd), 0);
  const minAgreement = points.reduce(
    (min, point) => Math.min(min, point.averageAgreement),
    100,
  );
  const xMax = maxCost * 1.15;
  const yMin = Math.max(0, Math.min(60, Math.floor(minAgreement / 10) * 10));
  const yTicks: number[] = [];

  for (let tick = yMin; tick <= 100; tick += 10) {
    yTicks.push(tick);
  }

  return {
    points,
    xMax,
    xTicks: [0, 1, 2, 3].map((index) => (xMax * index) / 3),
    yMin,
    yTicks,
  };
}

/* ------------------------------- Leaderboard ------------------------------ */

function leaderboardValue(stat: ModelRunStats, sort: LeaderboardSortKey): number | null {
  switch (sort) {
    case "agreement":
      return stat.averageAgreement;
    case "accuracy":
      return stat.averageAccuracy;
    case "latency":
      return stat.medianLatencyMs;
    case "cost":
      return stat.averageCostUsd;
    case "runs":
      return stat.runs;
  }
}

/**
 * Sorts summarizeModelRuns output. Rows without a value for the sort key are
 * always last; ties keep the catalog order summarizeModelRuns returns.
 */
export function sortLeaderboard(
  stats: readonly ModelRunStats[],
  sort: LeaderboardSortKey = DEFAULT_REPORTS_QUERY.sort,
  dir: SortDirection = defaultSortDirection(sort),
): ModelRunStats[] {
  const factor = dir === "asc" ? 1 : -1;

  return stats
    .map((stat, index) => ({ index, stat, value: leaderboardValue(stat, sort) }))
    .sort((left, right) => {
      if (left.value === null || right.value === null) {
        if (left.value === right.value) {
          return left.index - right.index;
        }

        return left.value === null ? 1 : -1;
      }

      return (left.value - right.value) * factor || left.index - right.index;
    })
    .map((entry) => entry.stat);
}

/* ---------------------------- Agreement matrix ---------------------------- */

export type AgreementMatrixColumn = {
  key: string;
  /** "Terra · High" */
  label: string;
  model: string;
  reasoningEffort: string | null;
};

export type AgreementMatrixCell = {
  /** Mean scored agreement over this combination's runs, or null when none is scored. */
  agreement: number | null;
  columnKey: string;
  /** True for the baseline's own model·effort ("Baseline" cell). */
  isBaseline: boolean;
  latestAgreement: number | null;
  latestCreatedAt: string | null;
  /** Latest re-run of this combination (the cell link), or null when there is none. */
  latestSubmissionId: string | null;
  /** Re-runs of this combination on this datasheet. */
  runCount: number;
  scoredRuns: number;
};

export type AgreementMatrixRow = {
  baselineSubmissionId: string;
  cells: AgreementMatrixCell[];
  packageCategory: PackageCategory;
  partNumber: string;
};

export type AgreementMatrix = {
  columns: AgreementMatrixColumn[];
  rows: AgreementMatrixRow[];
};

function compareColumns(left: AgreementMatrixColumn, right: AgreementMatrixColumn) {
  return (
    orderIndex(OPENAI_MODEL_IDS, left.model) - orderIndex(OPENAI_MODEL_IDS, right.model) ||
    left.model.localeCompare(right.model) ||
    orderIndex(OPENAI_REASONING_EFFORTS, left.reasoningEffort) -
      orderIndex(OPENAI_REASONING_EFFORTS, right.reasoningEffort)
  );
}

/**
 * Rows are reviewed baselines with at least one re-run in `submissions`.
 * Baselines are looked up in `baselinePool` (default: `submissions`) so a
 * model or date filter that excludes the baseline itself still shows the
 * runs it scopes. Columns are the model·effort combinations present, in
 * catalog then effort order.
 */
export function buildAgreementMatrix(
  submissions: readonly ReportSubmission[],
  baselinePool: readonly ReportSubmission[] = submissions,
): AgreementMatrix {
  const baselines = new Map(
    baselinePool
      .filter((submission) => submission.isBaseline && submission.reviewStatus === "reviewed")
      .map((submission) => [submission.submissionId, submission]),
  );
  const runsByRoot = new Map<string, ReportSubmission[]>();

  for (const submission of submissions) {
    if (submission.isBaseline || !baselines.has(submission.rootSubmissionId)) {
      continue;
    }

    const runs = runsByRoot.get(submission.rootSubmissionId);

    if (runs) {
      runs.push(submission);
    } else {
      runsByRoot.set(submission.rootSubmissionId, [submission]);
    }
  }

  const columns = new Map<string, AgreementMatrixColumn>();
  const addColumn = (providerMeta: ReportSubmission["providerMeta"]) => {
    const key = modelEffortKey(providerMeta);

    if (!columns.has(key)) {
      columns.set(key, {
        key,
        label: formatRunLabel(providerMeta),
        model: providerMeta.model,
        reasoningEffort: providerMeta.reasoningEffort ?? null,
      });
    }
  };

  for (const [rootId, runs] of runsByRoot) {
    addColumn((baselines.get(rootId) as ReportSubmission).providerMeta);
    runs.forEach((run) => addColumn(run.providerMeta));
  }

  const orderedColumns = Array.from(columns.values()).sort(compareColumns);

  const rows: AgreementMatrixRow[] = Array.from(runsByRoot, ([rootId, runs]) => {
    const baseline = baselines.get(rootId) as ReportSubmission;
    const baselineKey = modelEffortKey(baseline.providerMeta);

    return {
      baselineSubmissionId: rootId,
      cells: orderedColumns.map((column) => {
        const columnRuns = runs
          .filter((run) => modelEffortKey(run.providerMeta) === column.key)
          .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
        const scored = columnRuns
          .map(scoredAgreementOf)
          .filter((value): value is number => value !== null);
        const latest = columnRuns.at(-1) ?? null;

        return {
          agreement: roundOrNull(mean(scored)),
          columnKey: column.key,
          isBaseline: column.key === baselineKey,
          latestAgreement: latest ? scoredAgreementOf(latest) : null,
          latestCreatedAt: latest?.createdAt ?? null,
          latestSubmissionId: latest?.submissionId ?? null,
          runCount: columnRuns.length,
          scoredRuns: scored.length,
        };
      }),
      packageCategory: baseline.intake.packageCategory,
      partNumber: baseline.intake.partNumber,
    };
  }).sort(
    (left, right) =>
      left.partNumber.localeCompare(right.partNumber) ||
      left.baselineSubmissionId.localeCompare(right.baselineSubmissionId),
  );

  return { columns: orderedColumns, rows };
}

/* ---------------------------- Field corrections --------------------------- */

/** Fields with fewer decisions than this are left out (footnote). */
export const FIELD_CORRECTION_MIN_DECISIONS = 2;
export const FIELD_CORRECTION_TOP_N = 10;

export type FieldCorrectionStat = {
  corrected: number;
  /** Rounded percentage, corrected ÷ decided. */
  correctionRate: number;
  decided: number;
  key: string;
  label: string;
};

export type FieldCorrectionReport = {
  /** Measurement fields left out for having fewer than 2 decisions. */
  excludedFieldCount: number;
  /** Top 10 measurement fields by correction rate. */
  fields: FieldCorrectionStat[];
  package: FieldCorrectionStat | null;
  pins: FieldCorrectionStat | null;
  /** Fully reviewed submissions in scope. */
  reviewedSubmissions: number;
};

function toCorrectionStat(
  key: string,
  label: string,
  corrected: number,
  decided: number,
): FieldCorrectionStat | null {
  if (decided < FIELD_CORRECTION_MIN_DECISIONS) {
    return null;
  }

  return {
    corrected,
    correctionRate: Math.round((corrected / decided) * 100),
    decided,
    key,
    label,
  };
}

/** Correction rates across FULLY reviewed submissions in scope. */
export function buildFieldCorrectionStats(
  submissions: readonly ReportSubmission[],
): FieldCorrectionReport {
  const reviewed = submissions.filter((submission) => submission.reviewStatus === "reviewed");
  const fieldTotals = new Map<string, { corrected: number; decided: number }>();
  let pinCorrected = 0;
  let pinDecided = 0;
  let packageCorrected = 0;
  let packageDecided = 0;

  for (const submission of reviewed) {
    for (const decision of submission.measurementDecisions) {
      if (decision.status === "pending") {
        continue;
      }

      const totals = fieldTotals.get(decision.field) ?? { corrected: 0, decided: 0 };

      totals.decided += 1;
      totals.corrected += decision.status === "corrected" ? 1 : 0;
      fieldTotals.set(decision.field, totals);
    }

    pinCorrected += submission.pinDecisionCounts.corrected;
    pinDecided += submission.pinDecisionCounts.confirmed + submission.pinDecisionCounts.corrected;

    if (submission.packageDecision !== "pending") {
      packageDecided += 1;
      packageCorrected += submission.packageDecision === "corrected" ? 1 : 0;
    }
  }

  const eligible = Array.from(fieldTotals, ([field, totals]) => ({ field, ...totals })).filter(
    (entry) => entry.decided >= FIELD_CORRECTION_MIN_DECISIONS,
  );
  const fields = eligible
    .sort(
      (left, right) =>
        right.corrected / right.decided - left.corrected / left.decided ||
        right.corrected - left.corrected ||
        right.decided - left.decided ||
        left.field.localeCompare(right.field),
    )
    .slice(0, FIELD_CORRECTION_TOP_N)
    .map(
      (entry) =>
        toCorrectionStat(
          measurementRowKey(entry.field),
          entry.field,
          entry.corrected,
          entry.decided,
        ) as FieldCorrectionStat,
    );

  return {
    excludedFieldCount: fieldTotals.size - eligible.length,
    fields,
    package: toCorrectionStat("package", "Package", packageCorrected, packageDecided),
    pins: toCorrectionStat("pins", "Pins", pinCorrected, pinDecided),
    reviewedSubmissions: reviewed.length,
  };
}

/* ------------------------------ Filter options ---------------------------- */

export type ReportsFilterOptions = {
  categories: PackageCategory[];
  efforts: string[];
  models: string[];
};

/** Values present in the data, for the model, effort and category selects. */
export function buildReportsFilterOptions(
  submissions: readonly ReportSubmission[],
): ReportsFilterOptions {
  const models = new Set<string>();
  const efforts = new Set<string>();
  const categories = new Set<PackageCategory>();

  for (const submission of submissions) {
    models.add(submission.providerMeta.model);

    if (submission.providerMeta.reasoningEffort) {
      efforts.add(submission.providerMeta.reasoningEffort);
    }

    categories.add(submission.intake.packageCategory);
  }

  return {
    categories: Array.from(categories).sort((left, right) => left.localeCompare(right)),
    efforts: Array.from(efforts)
      .filter(isOpenAIReasoningEffort)
      .sort(
        (left, right) =>
          orderIndex(OPENAI_REASONING_EFFORTS, left) - orderIndex(OPENAI_REASONING_EFFORTS, right),
      ),
    models: sortModelIds(Array.from(models)),
  };
}

/* --------------------------------- All-in-one ------------------------------ */

export type ReportsData = {
  accuracyDistribution: AccuracyDistribution;
  agreementMatrix: AgreementMatrix;
  costAgreement: CostAgreementChart;
  /** The datasheet chip ("NE555DR ×"), when datasheet= matches a baseline. */
  datasheet: { partNumber: string; submissionId: string } | null;
  fieldCorrections: FieldCorrectionReport;
  filterOptions: ReportsFilterOptions;
  /** Submissions in scope after filtering. */
  inScope: ReportSubmission[];
  /** summarizeModelRuns(inScope), sorted by the query's sort and dir. */
  leaderboard: ModelRunStats[];
  overview: ReportsOverview;
};

export function buildReports(
  submissions: readonly ReportSubmission[],
  query: ReportsQuery,
  options: { defaults?: ModelEffortDefaults | null; now?: Date } = {},
): ReportsData {
  const inScope = filterReportSubmissions(submissions, query, options.now);
  const stats = summarizeModelRuns(inScope);
  const datasheetBaseline = query.datasheet
    ? submissions.find(
        (submission) => submission.isBaseline && submission.submissionId === query.datasheet,
      )
    : undefined;

  return {
    accuracyDistribution: buildAccuracyDistribution(inScope),
    agreementMatrix: buildAgreementMatrix(inScope, submissions),
    costAgreement: buildCostAgreementPoints(stats, options.defaults),
    datasheet: datasheetBaseline
      ? {
          partNumber: datasheetBaseline.intake.partNumber,
          submissionId: datasheetBaseline.submissionId,
        }
      : null,
    fieldCorrections: buildFieldCorrectionStats(inScope),
    filterOptions: buildReportsFilterOptions(submissions),
    inScope,
    leaderboard: sortLeaderboard(stats, query.sort, query.dir),
    overview: buildReportsOverview(inScope),
  };
}
