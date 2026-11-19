/**
 * Pure helpers for measurement value text, shared by the extraction rules,
 * the review checks and the scoring script. Client-safe.
 *
 * Values are free text as the AI or a reviewer wrote them, for example
 * "0.46 - 0.64 mm (0.018 - 0.025 in)", "1.0 ± 0.2 mm" or "1.60 mm max".
 */

const NOT_FOUND_PATTERN = /^not found\b/i;
const INCH_TOKEN = /(?:^|[\d.\s])(?:in|inch|inches)\.?(?=$|[\s,;)\]])|\d\s*"/i;
const MM_TOKEN = /\bmm\b/i;
const GROUP_PATTERN = /\s*([([])([^()[\]]*)[)\]]/g;
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const DEGREE_PATTERN = /\bdeg(?:rees?)?\b|°/i;

const INCH_TO_MM = 25.4;

/** A value read as millimetres. A missing bound means the datasheet gave only the other one ("max", "min"). */
export type MeasurementInterval = {
  max: number | null;
  min: number | null;
};

function hasInchUnit(text: string) {
  return INCH_TOKEN.test(text) && !MM_TOKEN.test(text);
}

function tidySpacing(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,;.)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/[,;]\s*$/, "")
    .trim();
}

/**
 * Drops inch equivalents when the value also states millimetres:
 * "0.46 - 0.64 mm (0.018 - 0.025 in)" becomes "0.46 - 0.64 mm", and
 * "0.118 ± 0.008 in [3.0 ± 0.2 mm]" becomes "3.0 ± 0.2 mm". Values without a
 * millimetre figure are returned unchanged.
 */
export function stripInchEquivalents(value: string): string {
  if (!INCH_TOKEN.test(value)) {
    return value;
  }

  const groups = Array.from(value.matchAll(GROUP_PATTERN), (match) => ({
    content: match[2],
    text: match[0],
  }));
  const main = groups.reduce((text, group) => text.replace(group.text, " "), value);
  const mainIsInch = hasInchUnit(main);
  const mmGroup = groups.find(
    (group) => MM_TOKEN.test(group.content) && /\d/.test(group.content),
  );

  if (mainIsInch && /\d/.test(main)) {
    // "0.047 in max. [1.2 mm max.]": the millimetre group is the whole value.
    return mmGroup ? tidySpacing(mmGroup.content) : value;
  }

  const inchGroups = groups.filter(
    (group) => /\d/.test(group.content) && hasInchUnit(group.content),
  );

  if (inchGroups.length === 0) {
    return value;
  }

  let result = value;

  for (const group of inchGroups) {
    result = result.replace(group.text, " ");
  }

  return tidySpacing(result);
}

function toNumber(text: string) {
  return Number.parseFloat(text.replace(",", "."));
}

function unitFactor(text: string) {
  if (/\bmils?\b/i.test(text)) {
    return 0.0254;
  }

  if (/(?:µm|\bum\b)/i.test(text)) {
    return 0.001;
  }

  return hasInchUnit(text) ? INCH_TO_MM : 1;
}

function scale(interval: MeasurementInterval, factor: number): MeasurementInterval {
  return {
    max: interval.max === null ? null : roundMm(interval.max * factor),
    min: interval.min === null ? null : roundMm(interval.min * factor),
  };
}

function roundMm(value: number) {
  return Math.round(value * 10000) / 10000;
}

const ASYMMETRIC_TOLERANCE = new RegExp(
  String.raw`(${NUMBER})\s*(?:mm)?\s*\+\s*(${NUMBER})\s*(?:mm)?\s*/\s*-\s*(${NUMBER})`,
  "g",
);
const SYMMETRIC_TOLERANCE = new RegExp(
  String.raw`(${NUMBER})\s*(?:mm)?\s*\(?\s*(?:±|\+/-|\+-)\s*(${NUMBER})`,
  "g",
);
/** "6.80 / 7.00 / 7.20 mm (min/typ/max)" or "0.05 / 0.15 mm". */
const SLASH_SEQUENCE = new RegExp(
  String.raw`(${NUMBER})\s*(?:mm)?\s*/\s*(${NUMBER})(?:\s*(?:mm)?\s*/\s*(${NUMBER}))?`,
  "g",
);
const RANGE = new RegExp(
  String.raw`(${NUMBER})\s*(?:mm)?\s*(?:-|to)\s*(${NUMBER})`,
  "gi",
);
/** Dimension labels such as "(A1)", "(T1)", "(E1)", "(b)" or "(φD)". */
const LABEL_GROUP = /\(\s*[A-Za-zφØ]{1,3}\d{0,2}\s*\)/g;
const QUALIFIED = new RegExp(
  String.raw`(${NUMBER})\s*(?:mm\.?\s*)?(max(?:imum)?|min(?:imum)?)\b`,
  "gi",
);
const PLAIN_NUMBER = new RegExp(NUMBER, "g");

function sameInterval(left: MeasurementInterval, right: MeasurementInterval) {
  return left.min === right.min && left.max === right.max;
}

function contains(interval: MeasurementInterval, value: number) {
  const tolerance = 1e-9;

  return (
    (interval.min === null || value >= interval.min - tolerance) &&
    (interval.max === null || value <= interval.max + tolerance)
  );
}

/**
 * Reads a value as a millimetre interval. "0.30–0.50 mm" is 0.30 to 0.50,
 * "1.0 ± 0.2" is 0.8 to 1.2, "0.60 +0.15/-0.10" is 0.50 to 0.75, "1.6 mm max"
 * has only a maximum and "0.65 BSC" is exactly 0.65. A nominal written next to
 * its range, as in "0.95 mm (0.90–1.00 mm)", reads as the range.
 *
 * Returns null for "Not found", angles, and text with two different
 * dimensions such as "h: 0.40–1.27 mm; L: 0.25–0.50 mm".
 */
export function parseMeasurementInterval(value: string | null | undefined): MeasurementInterval | null {
  if (!value || NOT_FOUND_PATTERN.test(value.trim()) || DEGREE_PATTERN.test(value)) {
    return null;
  }

  const metric = stripInchEquivalents(value);
  const factor = unitFactor(metric);
  const text = metric
    .replace(/[–—−~]/g, "-")
    // Labels such as "(D)", "(T1)", "(A1)" or "(min/typ/max)" are not figures.
    .replace(LABEL_GROUP, " ")
    .replace(/\(([^()\d]*)\)/g, " ")
    // A leading dimension label: "D: 0.10 mm min", "E = 2.0".
    .replace(/^\s*[A-Za-z][A-Za-z0-9]{0,3}\s*[:=]\s*/, "");

  const intervals: MeasurementInterval[] = [];
  let remaining = text;

  const take = (pattern: RegExp, build: (match: RegExpMatchArray) => MeasurementInterval | null) => {
    remaining = remaining.replace(pattern, (...args) => {
      const interval = build(args as unknown as RegExpMatchArray);

      if (interval) {
        intervals.push(interval);
      }

      return " ";
    });
  };

  take(ASYMMETRIC_TOLERANCE, (match) => {
    const nominal = toNumber(match[1]);

    return { max: nominal + toNumber(match[2]), min: nominal - toNumber(match[3]) };
  });
  take(SYMMETRIC_TOLERANCE, (match) => {
    const nominal = toNumber(match[1]);
    const tolerance = toNumber(match[2]);

    return { max: nominal + tolerance, min: Math.max(0, nominal - tolerance) };
  });
  take(SLASH_SEQUENCE, (match) => {
    const numbers = [match[1], match[2], match[3]]
      .filter((part): part is string => part !== undefined)
      .map(toNumber);
    const ascending = numbers.every((number, index) => index === 0 || number >= numbers[index - 1]);

    return ascending ? { max: numbers.at(-1)!, min: numbers[0] } : null;
  });
  take(RANGE, (match) => {
    const low = toNumber(match[1]);
    const high = toNumber(match[2]);

    return high >= low ? { max: high, min: low } : null;
  });
  take(QUALIFIED, (match) => {
    const number = toNumber(match[1]);

    return match[2].toLowerCase().startsWith("max")
      ? { max: number, min: null }
      : { max: null, min: number };
  });

  const loose = Array.from(remaining.matchAll(PLAIN_NUMBER), (match) => toNumber(match[0]));
  let distinct = intervals.filter(
    (interval, index) => intervals.findIndex((other) => sameInterval(other, interval)) === index,
  );

  // "0.05 mm min, 0.15 mm max" states the two bounds separately.
  if (distinct.length === 2) {
    const lower = distinct.find((interval) => interval.max === null && interval.min !== null);
    const upper = distinct.find((interval) => interval.min === null && interval.max !== null);

    if (lower && upper && lower.min! <= upper.max!) {
      distinct = [{ max: upper.max, min: lower.min }];
    }
  }

  if (distinct.length > 1) {
    return null;
  }

  if (distinct.length === 1) {
    const [interval] = distinct;

    // A nominal beside its range ("2.00 mm nom") is fine; any other number is a second dimension.
    return loose.every((number) => contains(interval, number)) ? scale(interval, factor) : null;
  }

  const uniqueLoose = Array.from(new Set(loose));

  if (uniqueLoose.length === 1) {
    return scale({ max: uniqueLoose[0], min: uniqueLoose[0] }, factor);
  }

  return null;
}

/** Reads a count such as "12", "15 pins per side" or "6 each side". Null when there is no whole number. */
export function parseCount(value: string | null | undefined): number | null {
  if (!value || NOT_FOUND_PATTERN.test(value.trim())) {
    return null;
  }

  const match = value.match(/\b(\d{1,4})\b/);

  return match ? Number.parseInt(match[1], 10) : null;
}

/** Tolerance for treating two millimetre figures as the same: 0.006 mm or 1 %. */
export function isSameMillimetres(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(0.006, Math.abs(right) * 0.01);
}
