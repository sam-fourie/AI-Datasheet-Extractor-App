import type { MeasurementFieldRow, PinRow } from "@/lib/package-categories";
import {
  buildSubmissionResolvedView,
  countReviewDecisions,
  deriveSubmissionReviewStatus,
} from "@/lib/submissions/review";
import type {
  AgreementOutcome,
  ExtractionSnapshot,
  ResolvedMeasurementRow,
  ResolvedPinRow,
  SubmissionAgreement,
  SubmissionAgreementRow,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

/**
 * Compares a re-run extraction against a baseline submission.
 *
 * Once the baseline has confirmed or corrected decisions, only those rows are
 * compared and the resolved (human-reviewed) values are the reference. Until
 * then every row is compared against the baseline's raw AI output so two
 * models can still be checked for consistency.
 *
 * Measurement values are free text, so numeric agreement is used: the same set
 * of numbers is a match, one side containing a subset of the other's numbers
 * is partial, anything else is a mismatch. Names use normalised identifiers.
 */

const NUMBER_PATTERN = /(?<![a-z])-?\d+(?:[.,]\d+)?/g;
const NUMBER_TOLERANCE = 1e-6;
const NOT_FOUND_LABEL = "Not found";
const MISSING_LABEL = "Missing";

type BaselineSubmission = {
  extraction: ExtractionSnapshot;
  review: SubmissionHumanReview;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0),
  );
}

function extractNumbers(value: string) {
  const numbers = Array.from(value.matchAll(NUMBER_PATTERN), (match) =>
    Number.parseFloat(match[0].replace(",", ".")),
  )
    .filter((number) => Number.isFinite(number))
    .sort((left, right) => left - right);
  const unique: number[] = [];

  for (const number of numbers) {
    const previous = unique.at(-1);

    if (previous === undefined || Math.abs(previous - number) > NUMBER_TOLERANCE) {
      unique.push(number);
    }
  }

  return unique;
}

function includesAllNumbers(haystack: number[], needles: number[]) {
  return needles.every((needle) =>
    haystack.some((candidate) => Math.abs(candidate - needle) <= NUMBER_TOLERANCE),
  );
}

function compareMeasurementText(
  baselineValue: string,
  rerunValue: string,
): AgreementOutcome {
  const baselineText = normalizeText(baselineValue);
  const rerunText = normalizeText(rerunValue);

  if (baselineText === rerunText) {
    return "match";
  }

  const baselineNumbers = extractNumbers(baselineText);
  const rerunNumbers = extractNumbers(rerunText);

  if (baselineNumbers.length > 0 && rerunNumbers.length > 0) {
    if (
      baselineNumbers.length === rerunNumbers.length &&
      includesAllNumbers(baselineNumbers, rerunNumbers)
    ) {
      return "match";
    }

    if (
      includesAllNumbers(baselineNumbers, rerunNumbers) ||
      includesAllNumbers(rerunNumbers, baselineNumbers)
    ) {
      return "partial";
    }

    return "mismatch";
  }

  return compareIdentifiers(baselineText, rerunText);
}

function compareIdentifiers(
  baselineValue: string,
  rerunValue: string,
): AgreementOutcome {
  const baselineIdentifier = normalizeIdentifier(baselineValue);
  const rerunIdentifier = normalizeIdentifier(rerunValue);

  if (baselineIdentifier.length === 0 || rerunIdentifier.length === 0) {
    return baselineIdentifier === rerunIdentifier ? "match" : "mismatch";
  }

  if (baselineIdentifier === rerunIdentifier) {
    return "match";
  }

  if (
    baselineIdentifier.includes(rerunIdentifier) ||
    rerunIdentifier.includes(baselineIdentifier)
  ) {
    return "partial";
  }

  const baselineTokens = tokenize(baselineValue);
  const rerunTokens = tokenize(rerunValue);
  const sharedTokens = Array.from(baselineTokens).filter((token) =>
    rerunTokens.has(token),
  ).length;
  const smallerTokenCount = Math.min(baselineTokens.size, rerunTokens.size);

  return smallerTokenCount > 0 && sharedTokens / smallerTokenCount >= 0.5
    ? "partial"
    : "mismatch";
}

function describeMeasurement(row: Pick<MeasurementFieldRow, "status" | "value">) {
  return row.status === "Not found" ? NOT_FOUND_LABEL : row.value;
}

function compareMeasurementRow(
  baseline: ResolvedMeasurementRow,
  rerun: MeasurementFieldRow | undefined,
): SubmissionAgreementRow {
  const baselineValue = describeMeasurement(baseline);

  if (!rerun) {
    return {
      baselineValue,
      kind: "measurement",
      label: baseline.field,
      outcome: "mismatch",
      rerunValue: MISSING_LABEL,
    };
  }

  const rerunValue = describeMeasurement(rerun);
  const baselineNotFound = baseline.status === "Not found";
  const rerunNotFound = rerun.status === "Not found";
  const outcome: AgreementOutcome =
    baselineNotFound || rerunNotFound
      ? baselineNotFound && rerunNotFound
        ? "match"
        : "mismatch"
      : compareMeasurementText(baseline.value, rerun.value);

  return {
    baselineValue,
    kind: "measurement",
    label: baseline.field,
    outcome,
    rerunValue,
  };
}

function comparePinRow(
  baseline: ResolvedPinRow,
  rerun: PinRow | undefined,
): SubmissionAgreementRow {
  return {
    baselineValue: baseline.pinName,
    kind: "pin",
    label: `Pin ${baseline.pinNumber}`,
    outcome: rerun ? compareIdentifiers(baseline.pinName, rerun.pinName) : "mismatch",
    rerunValue: rerun ? rerun.pinName : MISSING_LABEL,
  };
}

export function computeSubmissionAgreement(
  baseline: BaselineSubmission,
  rerunExtraction: ExtractionSnapshot,
): SubmissionAgreement {
  const resolved = buildSubmissionResolvedView(baseline);
  const decisionCounts = countReviewDecisions(baseline.review);
  const baselineReviewedDecisions = decisionCounts.confirmed + decisionCounts.corrected;
  const basis = baselineReviewedDecisions > 0 ? "reviewed" : "unreviewed";
  const includeRow = (reviewStatus: ResolvedMeasurementRow["reviewStatus"]) =>
    basis === "unreviewed" || reviewStatus !== "pending";
  const rerunFieldMap = new Map(
    rerunExtraction.fields.map((field) => [field.field.toLowerCase(), field] as const),
  );
  const rerunPinMap = new Map<string, PinRow>();

  for (const pinRow of rerunExtraction.pinRows) {
    const key = normalizeIdentifier(pinRow.pinNumber);

    if (!rerunPinMap.has(key)) {
      rerunPinMap.set(key, pinRow);
    }
  }

  const rows: SubmissionAgreementRow[] = [];

  if (includeRow(resolved.packageSelection.reviewStatus)) {
    rows.push({
      baselineValue: resolved.packageSelection.selectedPackage,
      kind: "package",
      label: "Package",
      outcome: compareIdentifiers(
        resolved.packageSelection.selectedPackage,
        rerunExtraction.packageSelection.selectedPackage,
      ),
      rerunValue: rerunExtraction.packageSelection.selectedPackage,
    });
  }

  for (const field of resolved.fields) {
    if (includeRow(field.reviewStatus)) {
      rows.push(
        compareMeasurementRow(field, rerunFieldMap.get(field.field.toLowerCase())),
      );
    }
  }

  for (const pinRow of resolved.pinRows) {
    if (includeRow(pinRow.reviewStatus)) {
      rows.push(
        comparePinRow(pinRow, rerunPinMap.get(normalizeIdentifier(pinRow.pinNumber))),
      );
    }
  }

  const matches = rows.filter((row) => row.outcome === "match").length;
  const partialMatches = rows.filter((row) => row.outcome === "partial").length;
  const mismatches = rows.length - matches - partialMatches;

  return {
    agreementPercentage:
      rows.length > 0 ? Math.round((matches / rows.length) * 100) : null,
    basis,
    baselineReviewStatus: deriveSubmissionReviewStatus(baseline.review),
    baselineReviewedDecisions,
    baselineTotalDecisions: decisionCounts.total,
    compared: rows.length,
    matches,
    mismatches,
    partialMatches,
    rows,
  };
}
