import type {
  ExtractionMeasurement,
  ExtractionPin,
  ExtractionResult,
} from "@/lib/ai";
import type { MeasurementFieldRow, PinRow } from "@/lib/package-categories";
import type { ExtractionSnapshot } from "@/lib/submissions/types";

export const NOT_FOUND_VALUE = "Not found in datasheet";

export function toMeasurementFieldRow(
  measurement: ExtractionMeasurement,
): MeasurementFieldRow {
  const status =
    measurement.status === "not_found"
      ? "Not found"
      : measurement.status === "needs_review"
        ? "Needs review"
        : "Extracted";

  return {
    confidence: measurement.confidence,
    evidencePages: measurement.evidencePages,
    field: measurement.field,
    status,
    value: measurement.value ?? NOT_FOUND_VALUE,
  };
}

export function toPinRow(pin: ExtractionPin): PinRow {
  return {
    confidence: pin.confidence,
    evidencePages: pin.evidencePages,
    pinName: pin.pinName,
    pinNumber: pin.pinNumber,
  };
}

/** Converts a provider result into the immutable snapshot persisted with a submission. */
export function buildExtractionSnapshot(
  extraction: ExtractionResult,
): ExtractionSnapshot {
  return {
    fields: extraction.measurements.map(toMeasurementFieldRow),
    packageSelection: extraction.packageSelection,
    pinRows: extraction.pins.map(toPinRow),
    providerMeta: extraction.providerMeta,
    review: extraction.review,
  };
}
