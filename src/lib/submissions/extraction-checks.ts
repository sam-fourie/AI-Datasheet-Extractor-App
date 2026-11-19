import {
  parseCount,
  parseMeasurementInterval,
  type MeasurementInterval,
} from "@/lib/ai/measurement-values";
import {
  isExposedPadPin,
  listPinNumbers,
  mentionsExposedPad,
  readPackagePinCount,
} from "@/lib/ai/package-text";
import type { ExtractionSnapshot } from "@/lib/submissions/types";

/**
 * Checks code can make on an extraction without the PDF: rows that list
 * several pins, a pin list that doesn't match the package's pin count, and
 * measurements that can't all be true together. They read the AI's values
 * (the immutable snapshot), run on read for every submission, and feed the
 * review attention reasons in review.ts. Client-safe.
 */

export type PinCountCheck = {
  /** The pin count the package description states. */
  expected: number;
  /** Whether the package description mentions an exposed pad. */
  exposedPad: boolean;
  /** Separate pins listed, not counting the exposed pad. */
  listed: number;
  /** Whether a row is the exposed pad. */
  padListed: boolean;
};

export type ExtractionChecks = {
  /** Pin row indexes whose number lists several pins ("1, 2, 3" or "13–16"). */
  groupedPinIndexes: ReadonlySet<number>;
  /** Lower-cased field names of measurements that conflict with another measurement. */
  inconsistentFields: ReadonlySet<string>;
  /** Set only when the pin list doesn't match the package. */
  pinCountMismatch: PinCountCheck | null;
};

const cache = new WeakMap<ExtractionSnapshot, ExtractionChecks>();

/** The checks for an extraction, computed once per snapshot object. */
export function checkExtraction(extraction: ExtractionSnapshot): ExtractionChecks {
  const cached = cache.get(extraction);

  if (cached) {
    return cached;
  }

  const checks: ExtractionChecks = {
    groupedPinIndexes: findGroupedPins(extraction),
    inconsistentFields: findInconsistentFields(extraction),
    pinCountMismatch: findPinCountMismatch(extraction),
  };

  cache.set(extraction, checks);

  return checks;
}

function findGroupedPins(extraction: ExtractionSnapshot) {
  const indexes = new Set<number>();

  extraction.pinRows.forEach((pin, index) => {
    if (listPinNumbers(pin.pinNumber).length > 1) {
      indexes.add(index);
    }
  });

  return indexes;
}

export function evaluatePinCount(
  extraction: Pick<ExtractionSnapshot, "packageSelection" | "pinRows">,
): PinCountCheck | null {
  const packageText = extraction.packageSelection.selectedPackage;
  const expected = readPackagePinCount(packageText);

  if (expected === null) {
    return null;
  }

  const numbers = new Set<string>();
  let padListed = false;

  for (const pin of extraction.pinRows) {
    if (isExposedPadPin(pin)) {
      padListed = true;
      continue;
    }

    for (const number of listPinNumbers(pin.pinNumber)) {
      numbers.add(number.toLowerCase());
    }
  }

  return {
    expected,
    exposedPad: mentionsExposedPad(packageText),
    listed: numbers.size,
    padListed,
  };
}

/**
 * The pin list is wrong when it has fewer or more pins than the package. One
 * extra pin is allowed when no row is named as the pad, because the pad is
 * often listed under its net ("25: GND"). A package that mentions an exposed
 * pad needs a pad row, since the house counts the pad as a pin.
 */
function findPinCountMismatch(extraction: ExtractionSnapshot): PinCountCheck | null {
  const check = evaluatePinCount(extraction);

  if (!check) {
    return null;
  }

  const { expected, exposedPad, listed, padListed } = check;
  const unnamedPad = !padListed && listed === expected + 1;

  if (listed !== expected && !unnamedPad) {
    return check;
  }

  if (exposedPad && !padListed && !unnamedPad) {
    return check;
  }

  return null;
}

function findInconsistentFields(extraction: ExtractionSnapshot) {
  const intervals = new Map<string, MeasurementInterval>();
  const counts = new Map<string, number>();

  for (const field of extraction.fields) {
    if (field.status === "Not found") {
      continue;
    }

    const key = field.field.toLowerCase();
    const interval = parseMeasurementInterval(field.value);
    const count = parseCount(field.value);

    if (interval) {
      intervals.set(key, interval);
    }

    if (count !== null) {
      counts.set(key, count);
    }
  }

  const fieldNames = new Set(extraction.fields.map((field) => field.field.toLowerCase()));
  const inconsistent = new Set<string>();

  /** Flags both fields when `smaller` can only be at least as large as `larger`. */
  const mustBeSmaller = (smaller: string, larger: string) => {
    const low = intervals.get(smaller);
    const high = intervals.get(larger);

    if (low?.min != null && high?.max != null && low.min >= high.max - 1e-9) {
      inconsistent.add(smaller);
      inconsistent.add(larger);
    }
  };

  mustBeSmaller("stand off", "height");
  mustBeSmaller("pin width", "pin pitch");
  mustBeSmaller("pin width 1", "pin pitch");
  mustBeSmaller("pin diameter", "pin pitch");

  const bodyLength = intervals.get("body length");
  const bodyWidth = intervals.get("body width");
  const largerBodySide =
    bodyLength?.max != null && bodyWidth?.max != null
      ? bodyLength.max >= bodyWidth.max
        ? "body length"
        : "body width"
      : bodyLength
        ? "body length"
        : "body width";

  mustBeSmaller("thermal pad length", largerBodySide);
  mustBeSmaller("thermal pad width", largerBodySide);

  if (fieldNames.has("pin pitch") && fieldNames.has("pin span")) {
    // Two rows of leads: the tips stand out past the body on both sides.
    mustBeSmaller("body width", "pin span");
  } else if (fieldNames.has("pin span") && fieldNames.has("body length")) {
    // SOD packages: the leads stand out past both ends of the body.
    mustBeSmaller("body length", "pin span");
  } else if (fieldNames.has("pin length 1")) {
    // Moulded two-terminal parts: a terminal can't be longer than the part.
    mustBeSmaller("pin width 1", "pin span");
    mustBeSmaller("pin width 2", "pin span");
  }

  const leftRight = counts.get("left/right pins");
  const topBottom = counts.get("top/bottom pins");

  if (leftRight !== undefined && topBottom !== undefined) {
    // Pins around the edge: the package's count, or the pins listed when it has none.
    const listed = new Set(
      extraction.pinRows
        .filter((pin) => !isExposedPadPin(pin))
        .flatMap((pin) => listPinNumbers(pin.pinNumber)),
    ).size;
    const expected = evaluatePinCount(extraction)?.expected ?? (listed > 0 ? listed : null);

    if (expected !== null && 2 * (leftRight + topBottom) !== expected) {
      inconsistent.add("left/right pins");
      inconsistent.add("top/bottom pins");
    }
  }

  return inconsistent;
}
