import type { ExtractionMeasurement, ExtractionPin } from "@/lib/ai";
import {
  getTwoTerminalKind,
  getTwoTerminalPins,
  type TwoTerminalKind,
} from "@/lib/ai/extraction-rules";
import { stripInchEquivalents } from "@/lib/ai/measurement-values";
import {
  describeCategoryMismatch,
  isExposedPadPin,
} from "@/lib/ai/package-text";
import type { PackageCategory } from "@/lib/package-categories";

/**
 * Applies the parts of the rulebook that code can apply to a v2 extraction,
 * before it is saved. Pure: no SDK or storage imports.
 */

const OVERLINE_MARKS = /[̄̅‾]/g;
const HAS_OVERLINE = /[̄̅‾]/;

function normalizeActiveLowSegment(segment: string): string {
  let text = segment.trim();
  let activeLow = false;

  if (HAS_OVERLINE.test(text)) {
    text = text.replace(OVERLINE_MARKS, "").trim();
    activeLow = true;
  }

  if (/^[~!](?=[A-Za-z])/.test(text)) {
    text = text.slice(1);
    activeLow = true;
  }

  if (text.length > 1 && text.endsWith("#")) {
    text = text.slice(0, -1).trim();
    activeLow = true;
  }

  if (!activeLow || text.length === 0) {
    return segment;
  }

  return text.startsWith("*") ? text : `*${text}`;
}

/**
 * Writes active-low pins the house way: "CS̅" (an overbar), "CS#" and "~CS"
 * become "*CS", and each part of a combined name is marked on its own:
 * "R̅E̅S̅E̅T̅/FAIL-SAFE" becomes "*RESET/FAIL-SAFE". A leading "/" marks the
 * whole name: "/RESET" becomes "*RESET". "I/O" is left alone.
 */
export function normalizeActiveLowName(name: string): string {
  const trimmed = name.trim();

  if (/^\/[A-Za-z]/.test(trimmed)) {
    return `*${normalizeActiveLowName(trimmed.slice(1)).replace(/^\*/, "")}`;
  }

  return trimmed.split("/").map(normalizeActiveLowSegment).join("/");
}

/** "Cathode" or "K (cathode)" become K on a diode; "Positive" becomes + on a polarised capacitor. */
export function normalizeTwoTerminalPinName(name: string, kind: TwoTerminalKind): string {
  const trimmed = name.trim();

  switch (kind) {
    case "diode":
      if (/^(?:k\b|cathode\b)/i.test(trimmed)) {
        return "K";
      }

      if (/^(?:a\b|anode\b)/i.test(trimmed)) {
        return "A";
      }

      return trimmed;
    case "polarisedCapacitor":
      if (/^(?:\+|positive\b|anode\b)/i.test(trimmed)) {
        return "+";
      }

      if (/^(?:-|−|–|negative\b|cathode\b)/i.test(trimmed)) {
        return "-";
      }

      return trimmed;
    case "nonPolarised": {
      const numbered = trimmed.match(/^(?:terminal|pin|electrode)\s*(\d)$/i);

      return numbered ? numbered[1] : trimmed;
    }
  }
}

function isPlainPinNumber(value: string) {
  return /^\d+$/.test(value.trim());
}

/** Names the exposed pad EP and, when it has no number, gives it the next one after the last pin. */
function normalizeExposedPads(pins: ExtractionPin[]): ExtractionPin[] {
  const padIndexes = new Set(
    pins.flatMap((pin, index) => (isExposedPadPin(pin) ? [index] : [])),
  );

  if (padIndexes.size === 0) {
    return pins;
  }

  let nextNumber =
    pins.reduce(
      (highest, pin, index) =>
        !padIndexes.has(index) && isPlainPinNumber(pin.pinNumber)
          ? Math.max(highest, Number.parseInt(pin.pinNumber, 10))
          : highest,
      0,
    ) + 1;
  const hasNumberedPins = nextNumber > 1;

  return pins.map((pin, index) => {
    if (!padIndexes.has(index)) {
      return pin;
    }

    if (isPlainPinNumber(pin.pinNumber) || !hasNumberedPins) {
      return { ...pin, pinName: "EP" };
    }

    const pinNumber = String(nextNumber);

    nextNumber += 1;

    return { ...pin, pinName: "EP", pinNumber };
  });
}

export type ExtractionRulesInput = {
  /** The AI's own review notes, so a rule doesn't repeat what the AI already said. */
  aiNotes?: readonly string[];
  measurements: ExtractionMeasurement[];
  packageCategory: PackageCategory;
  pins: ExtractionPin[];
  selectedPackage: string;
};

export type ExtractionRulesOutcome = {
  measurements: ExtractionMeasurement[];
  /** Extra review notes, in the AI notes list. */
  notes: string[];
  /** True when a rule wants a person to look, such as a category mismatch. */
  needsReview: boolean;
  pins: ExtractionPin[];
};

export function applyExtractionRules(input: ExtractionRulesInput): ExtractionRulesOutcome {
  const notes: string[] = [];
  let needsReview = false;
  const measurements = input.measurements.map((measurement) =>
    measurement.value === null
      ? measurement
      : { ...measurement, value: stripInchEquivalents(measurement.value) },
  );
  const twoTerminalKind = getTwoTerminalKind(input.packageCategory);
  let pins = input.pins.map((pin) => ({
    ...pin,
    pinName: normalizeActiveLowName(pin.pinName),
  }));

  if (twoTerminalKind) {
    const defaults = getTwoTerminalPins(input.packageCategory) ?? [];

    if (pins.length === 0 && defaults.length > 0) {
      pins = defaults.map((pin) => ({
        confidence: "medium",
        evidencePages: [],
        pinName: pin.pinName,
        pinNumber: pin.pinNumber,
      }));
      notes.push(
        `The datasheet doesn't number the terminals, so the pins follow the house rule: ${defaults
          .map((pin) => `${pin.pinNumber} is ${pin.pinName}`)
          .join(", ")}.`,
      );
    } else {
      pins = pins.map((pin) => ({
        ...pin,
        pinName: normalizeTwoTerminalPinName(pin.pinName, twoTerminalKind),
      }));
    }
  } else {
    pins = normalizeExposedPads(pins);
  }

  const mismatch = describeCategoryMismatch(input.packageCategory, input.selectedPackage);

  if (mismatch) {
    needsReview = true;

    // The AI often says this itself; one note is enough.
    if (!(input.aiNotes ?? []).some((note) => /\bcategor/i.test(note))) {
      notes.push(mismatch);
    }
  }

  return { measurements, needsReview, notes, pins };
}
