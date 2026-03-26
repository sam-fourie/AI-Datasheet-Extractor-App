import {
  type ConfidenceLevel,
  type PackageCategory,
  type ProviderMeta,
  type ReviewSummary,
} from "@/lib/package-categories";

import { OpenAIExtractionProvider } from "./openai-provider";

export type ExtractionMeasurementStatus = "found" | "needs_review" | "not_found";

export type ExtractionInput = {
  packageCategory: PackageCategory;
  partNumber: string;
  pdfBytes: Uint8Array;
  pdfFileName: string;
  requestedFields: readonly string[];
  sourceLabel: string;
};

export type ExtractionMeasurement = {
  confidence: ConfidenceLevel;
  evidencePages: number[];
  field: string;
  status: ExtractionMeasurementStatus;
  value: string | null;
};

export type ExtractionPin = {
  confidence: ConfidenceLevel;
  evidencePages: number[];
  pinName: string;
  pinNumber: string;
};

export type ExtractionPackageSelection = {
  alternatives: string[];
  confidence: ConfidenceLevel;
  selectedPackage: string;
};

export type ExtractionResult = {
  measurements: ExtractionMeasurement[];
  packageSelection: ExtractionPackageSelection;
  pins: ExtractionPin[];
  providerMeta: ProviderMeta;
  review: ReviewSummary;
};

export interface AiProvider {
  extractDatasheet(input: ExtractionInput): Promise<ExtractionResult>;
}

export async function extractDatasheet(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const provider = new OpenAIExtractionProvider();

  return provider.extractDatasheet(input);
}
