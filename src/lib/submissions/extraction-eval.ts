import {
  isSameMillimetres,
  parseMeasurementInterval,
  stripInchEquivalents,
  type MeasurementInterval,
} from "@/lib/ai/measurement-values";
import { isExposedPadPin, listPinNumbers } from "@/lib/ai/package-text";
import type { MeasurementFieldStatus } from "@/lib/package-categories";
import { computeSubmissionAgreement } from "@/lib/submissions/agreement";
import { buildSubmissionResolvedView } from "@/lib/submissions/review";
import type {
  ExtractionSnapshot,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

/**
 * Scores an extraction against a reviewed submission: the reviewer's
 * confirmed and corrected values are the answer key. Used by
 * scripts/score-extractions.ts to compare prompt versions. Pure.
 *
 * Unlike the app's agreement score, which compares the numbers in the text,
 * this compares what the values mean: "1.0 ± 0.2 mm" and "0.8–1.2 mm" are the
 * same, inch equivalents are ignored, and Height is judged by its maximum (the
 * house rule). "partial" means the same dimension written differently or less
 * precisely, such as a nominal against its range or "*CS" against "CS".
 */

export type EvalOutcome = "right" | "partial" | "wrong" | "missing";

export type EvalRow = {
  actual: string;
  expected: string;
  kind: "measurement" | "pin";
  label: string;
  outcome: EvalOutcome;
  /** Whether the reviewer confirmed the AI's value or corrected it. */
  reviewStatus: "confirmed" | "corrected";
};

export type EvalTally = Record<EvalOutcome, number> & { total: number };

export type ExtractionEval = {
  /** The app's agreement score for the same pair (exact numbers and names), for reference. */
  agreementPercentage: number | null;
  measurements: EvalTally;
  pins: EvalTally;
  rows: EvalRow[];
};

const NOT_FOUND_LABEL = "Not found";
const MISSING_LABEL = "Missing";

type MeasurementSide = { status: MeasurementFieldStatus; value: string };

function isNotFound(side: MeasurementSide) {
  return side.status === "Not found";
}

function highest(interval: MeasurementInterval) {
  return interval.max ?? interval.min;
}

function sameBound(left: number | null, right: number | null) {
  return left === null || right === null ? left === right : isSameMillimetres(left, right);
}

function within(inner: MeasurementInterval, outer: MeasurementInterval) {
  const tolerance = 0.006;
  const innerLow = inner.min ?? -Infinity;
  const innerHigh = inner.max ?? Infinity;
  const outerLow = outer.min ?? -Infinity;
  const outerHigh = outer.max ?? Infinity;

  return innerLow >= outerLow - tolerance && innerHigh <= outerHigh + tolerance;
}

function compareIntervals(
  field: string,
  expected: MeasurementInterval,
  actual: MeasurementInterval,
): EvalOutcome {
  if (field.trim().toLowerCase() === "height") {
    const expectedMax = highest(expected);
    const actualMax = highest(actual);

    if (expectedMax !== null && actualMax !== null && isSameMillimetres(actualMax, expectedMax)) {
      return "right";
    }
  }

  if (sameBound(expected.min, actual.min) && sameBound(expected.max, actual.max)) {
    return "right";
  }

  return within(actual, expected) || within(expected, actual) ? "partial" : "wrong";
}

const NUMBER_PATTERN = /(?<![a-z])\d+(?:[.,]\d+)?/gi;

function numbersIn(value: string) {
  return Array.from(
    new Set(Array.from(value.matchAll(NUMBER_PATTERN), (match) => Number.parseFloat(match[0].replace(",", ".")))),
  );
}

/** Fallback for text the interval reader can't read: the same numbers, or a subset. */
function compareNumbers(expected: string, actual: string): EvalOutcome {
  const expectedNumbers = numbersIn(stripInchEquivalents(expected));
  const actualNumbers = numbersIn(stripInchEquivalents(actual));

  if (expectedNumbers.length === 0 || actualNumbers.length === 0) {
    return expected.trim().toLowerCase() === actual.trim().toLowerCase() ? "right" : "wrong";
  }

  const has = (list: number[], value: number) => list.some((item) => isSameMillimetres(item, value));
  const actualInExpected = actualNumbers.every((value) => has(expectedNumbers, value));
  const expectedInActual = expectedNumbers.every((value) => has(actualNumbers, value));

  if (actualInExpected && expectedInActual) {
    return "right";
  }

  return actualInExpected || expectedInActual ? "partial" : "wrong";
}

export function compareMeasurementValues(
  field: string,
  expected: MeasurementSide,
  actual: MeasurementSide,
): EvalOutcome {
  if (isNotFound(expected) || isNotFound(actual)) {
    return isNotFound(expected) && isNotFound(actual) ? "right" : "wrong";
  }

  const expectedInterval = parseMeasurementInterval(expected.value);
  const actualInterval = parseMeasurementInterval(actual.value);

  if (expectedInterval && actualInterval) {
    return compareIntervals(field, expectedInterval, actualInterval);
  }

  return compareNumbers(expected.value, actual.value);
}

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/[−–—]/g, "-")
    // The AC pins of a bridge are written with either tilde.
    .replace(/[∼～]/g, "~")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** House spellings of the same pin, so a review saved before a rule doesn't count it wrong. */
const PIN_NAME_SYNONYMS: Record<string, string> = { anode: "a", cathode: "k" };

/** The name's letters, without and with the channel suffix the house adds to repeats ("A_1"). */
function identifiersOf(value: string) {
  // A description after the name: "G (gate)", "K (cathode)".
  const name = normalizeName(value).replace(/\s*\([^)]*\)\s*$/, "");
  const letters = (text: string) => {
    const identifier = text.replace(/[^a-z0-9+~-]/g, "");

    return PIN_NAME_SYNONYMS[identifier] ?? identifier;
  };

  return new Set([letters(name), letters(name.replace(/_\d+$/, ""))].filter((id) => id.length > 0));
}

/**
 * Pin names: the same text is right. The same name written differently is
 * partial: "*CS" against "CS", "A_1" against "A" or "A1", "G" against
 * "G (gate)", "K" against "Cathode".
 */
export function comparePinNames(expected: string, actual: string): EvalOutcome {
  if (normalizeName(expected) === normalizeName(actual)) {
    return "right";
  }

  const actualIdentifiers = identifiersOf(actual);

  return [...identifiersOf(expected)].some((identifier) => actualIdentifiers.has(identifier))
    ? "partial"
    : "wrong";
}

function emptyTally(): EvalTally {
  return { missing: 0, partial: 0, right: 0, total: 0, wrong: 0 };
}

function pinKey(pinNumber: string) {
  return pinNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function evaluateExtraction(
  baseline: { extraction: ExtractionSnapshot; review: SubmissionHumanReview },
  candidate: ExtractionSnapshot,
): ExtractionEval {
  const resolved = buildSubmissionResolvedView(baseline);
  const rows: EvalRow[] = [];
  const candidateFields = new Map(
    candidate.fields.map((field) => [field.field.trim().toLowerCase(), field]),
  );

  for (const field of resolved.fields) {
    if (field.reviewStatus === "pending") {
      continue;
    }

    const actual = candidateFields.get(field.field.trim().toLowerCase());

    rows.push({
      actual: actual ? (actual.status === "Not found" ? NOT_FOUND_LABEL : actual.value) : MISSING_LABEL,
      expected: field.status === "Not found" ? NOT_FOUND_LABEL : field.value,
      kind: "measurement",
      label: field.field,
      outcome: actual ? compareMeasurementValues(field.field, field, actual) : "missing",
      reviewStatus: field.reviewStatus,
    });
  }

  const candidatePins = new Map<string, string>();
  // The exposed pad is matched pad to pad: the house rule renumbers it ("25: EP").
  const candidatePad = candidate.pinRows.find((pin) => isExposedPadPin(pin));

  for (const pin of candidate.pinRows) {
    for (const number of listPinNumbers(pin.pinNumber)) {
      const key = pinKey(number);

      if (!candidatePins.has(key)) {
        candidatePins.set(key, pin.pinName);
      }
    }
  }

  for (const pin of resolved.pinRows) {
    if (pin.reviewStatus === "pending") {
      continue;
    }

    if (isExposedPadPin(pin)) {
      const actual = candidatePad?.pinName;
      const outcome =
        actual === undefined ? "missing" : comparePinNames(pin.pinName, actual) === "right" ? "right" : "partial";

      rows.push({
        actual: candidatePad ? `${candidatePad.pinNumber}: ${candidatePad.pinName}` : MISSING_LABEL,
        expected: `${pin.pinNumber}: ${pin.pinName}`,
        kind: "pin",
        label: "Exposed pad",
        outcome,
        reviewStatus: pin.reviewStatus,
      });
      continue;
    }

    for (const number of listPinNumbers(pin.pinNumber)) {
      const actual = candidatePins.get(pinKey(number));

      rows.push({
        actual: actual ?? MISSING_LABEL,
        expected: pin.pinName,
        kind: "pin",
        label: `Pin ${number}`,
        outcome: actual === undefined ? "missing" : comparePinNames(pin.pinName, actual),
        reviewStatus: pin.reviewStatus,
      });
    }
  }

  const measurements = emptyTally();
  const pins = emptyTally();

  for (const row of rows) {
    const tally = row.kind === "measurement" ? measurements : pins;

    tally[row.outcome] += 1;
    tally.total += 1;
  }

  return {
    agreementPercentage: computeSubmissionAgreement(baseline, candidate).agreementPercentage,
    measurements,
    pins,
    rows,
  };
}

/** Adds tallies together, for totals across datasheets. */
export function sumTallies(tallies: readonly EvalTally[]): EvalTally {
  return tallies.reduce<EvalTally>(
    (sum, tally) => ({
      missing: sum.missing + tally.missing,
      partial: sum.partial + tally.partial,
      right: sum.right + tally.right,
      total: sum.total + tally.total,
      wrong: sum.wrong + tally.wrong,
    }),
    emptyTally(),
  );
}
