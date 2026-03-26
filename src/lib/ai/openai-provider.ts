import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import type {
  AiProvider,
  ExtractionInput,
  ExtractionMeasurement,
  ExtractionPackageSelection,
  ExtractionPin,
  ExtractionResult,
} from "@/lib/ai";
import type { ConfidenceLevel, ReviewSummary } from "@/lib/package-categories";

const OPENAI_MODEL = "gpt-5.4";

const confidenceSchema = z.enum(["high", "medium", "low"]);

const extractedMeasurementSchema = z.object({
  confidence: confidenceSchema,
  evidencePages: z.array(z.number().int().positive()).default([]),
  field: z.string().trim().min(1),
  status: z.enum(["found", "needs_review", "not_found"]),
  value: z.string().trim().nullable(),
});

const extractedPinSchema = z.object({
  confidence: confidenceSchema,
  evidencePages: z.array(z.number().int().positive()).default([]),
  pinName: z.string().trim().min(1),
  pinNumber: z.string().trim().min(1),
});

const extractionSchema = z.object({
  measurements: z.array(extractedMeasurementSchema),
  packageSelection: z.object({
    alternatives: z.array(z.string().trim().min(1)).default([]),
    confidence: confidenceSchema,
    selectedPackage: z.string().trim().min(1),
  }),
  pins: z.array(extractedPinSchema),
  review: z.object({
    needsReview: z.boolean(),
    notes: z.array(z.string().trim().min(1)).default([]),
  }),
});

type ParsedExtraction = z.infer<typeof extractionSchema>;

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }

  return openAIClient;
}

function normalizeEvidencePages(pages: number[]) {
  return Array.from(new Set(pages.filter((page) => Number.isInteger(page) && page > 0)))
    .sort((left, right) => left - right);
}

function normalizeConfidence(value: ConfidenceLevel | undefined): ConfidenceLevel {
  return value ?? "low";
}

function normalizeMeasurements(
  requestedFields: readonly string[],
  measurements: ParsedExtraction["measurements"],
): ExtractionMeasurement[] {
  const measurementMap = new Map(
    measurements.map((measurement) => [measurement.field.toLowerCase(), measurement]),
  );

  return requestedFields.map((field) => {
    const measurement = measurementMap.get(field.toLowerCase());

    if (!measurement) {
      return {
        confidence: "low",
        evidencePages: [],
        field,
        status: "not_found",
        value: null,
      };
    }

    return {
      confidence: normalizeConfidence(measurement.confidence),
      evidencePages: normalizeEvidencePages(measurement.evidencePages),
      field,
      status: measurement.status,
      value: measurement.value?.trim() || null,
    };
  });
}

function normalizePins(pins: ParsedExtraction["pins"]): ExtractionPin[] {
  return pins
    .map((pin) => ({
      confidence: normalizeConfidence(pin.confidence),
      evidencePages: normalizeEvidencePages(pin.evidencePages),
      pinName: pin.pinName.trim(),
      pinNumber: pin.pinNumber.trim(),
    }))
    .filter((pin) => pin.pinName.length > 0 && pin.pinNumber.length > 0);
}

function buildReviewSummary(
  parsed: ParsedExtraction,
  measurements: ExtractionMeasurement[],
  pins: ExtractionPin[],
): ReviewSummary {
  const derivedNotes = new Set(parsed.review.notes);

  if (measurements.some((measurement) => measurement.status === "needs_review")) {
    derivedNotes.add("One or more measurements need manual review.");
  }

  if (pins.some((pin) => pin.confidence === "low")) {
    derivedNotes.add("At least one pin mapping has low confidence.");
  }

  if (parsed.packageSelection.confidence === "low") {
    derivedNotes.add("The selected package variant is a best guess and should be reviewed.");
  }

  return {
    needsReview:
      parsed.review.needsReview ||
      measurements.some((measurement) => measurement.status === "needs_review") ||
      pins.some((pin) => pin.confidence === "low") ||
      parsed.packageSelection.confidence === "low",
    notes: Array.from(derivedNotes),
  };
}

function buildPrompt(input: ExtractionInput) {
  return [
    "Extract semiconductor package measurements and pin mappings from the attached datasheet PDF.",
    `Part number: ${input.partNumber}`,
    `Package category: ${input.packageCategory}`,
    `Requested measurement fields: ${input.requestedFields.join(", ")}`,
    "",
    "Rules:",
    "- Use only information found in the PDF.",
    "- Return every requested measurement field exactly once.",
    "- If a value is missing or unsupported, set status to not_found and value to null.",
    "- If evidence is weak or there are conflicting values, set status to needs_review.",
    "- Return pin numbers exactly as shown in the datasheet, preserving letters if present.",
    "- Choose the best matching package for the part number and package category, but set needsReview when confidence is weak.",
    "- Evidence pages must be page numbers from the PDF.",
  ].join("\n");
}

function buildPackageSelection(
  parsed: ParsedExtraction["packageSelection"],
): ExtractionPackageSelection {
  return {
    alternatives: parsed.alternatives,
    confidence: parsed.confidence,
    selectedPackage: parsed.selectedPackage,
  };
}

export class OpenAIExtractionProvider implements AiProvider {
  async extractDatasheet(input: ExtractionInput): Promise<ExtractionResult> {
    const base64Pdf = Buffer.from(input.pdfBytes).toString("base64");

    const response = await getOpenAIClient().responses.parse({
      model: OPENAI_MODEL,
      reasoning: {
        effort: "medium",
      },
      input: [
        {
          role: "developer",
          content:
            "You extract datasheet measurements and pin maps into a strict schema. Never invent values. Use not_found or needs_review instead of guessing silently.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(input),
            },
            {
              type: "input_file",
              filename: input.pdfFileName,
              file_data: `data:application/pdf;base64,${base64Pdf}`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(extractionSchema, "datasheet_extraction"),
        verbosity: "low",
      },
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      throw new Error("OpenAI returned an empty extraction payload.");
    }

    const measurements = normalizeMeasurements(input.requestedFields, parsed.measurements);
    const pins = normalizePins(parsed.pins);
    const packageSelection = buildPackageSelection(parsed.packageSelection);
    const review = buildReviewSummary(parsed, measurements, pins);

    return {
      measurements,
      packageSelection,
      pins,
      providerMeta: {
        model: OPENAI_MODEL,
        provider: "openai",
      },
      review,
    };
  }
}
