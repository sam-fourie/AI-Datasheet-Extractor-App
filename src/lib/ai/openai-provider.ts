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
import {
  ExtractionCancelledError,
  ExtractionTimeoutError,
} from "@/lib/ai/errors";
import { applyExtractionRules } from "@/lib/ai/extraction-postprocess";
import {
  buildRulebookPrompt,
  DEFAULT_EXTRACTION_PROMPT_VERSION,
  RULEBOOK_DEVELOPER_MESSAGE,
  type ExtractionPromptVersion,
} from "@/lib/ai/extraction-rules";
import {
  estimateExtractionCostUsd,
  EXTRACTION_REQUEST_TIMEOUT_MS,
} from "@/lib/ai/models";
import type {
  ConfidenceLevel,
  ProviderMeta,
  ProviderUsage,
  ReviewSummary,
} from "@/lib/package-categories";

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

/** With a package drawing attached, every row also says which file its evidence pages are in. */
const evidenceFileSchema = z.enum(["datasheet", "drawing"]);

const drawingExtractionSchema = extractionSchema.extend({
  measurements: z.array(extractedMeasurementSchema.extend({ evidenceFile: evidenceFileSchema })),
  pins: z.array(extractedPinSchema.extend({ evidenceFile: evidenceFileSchema })),
});

type ParsedExtraction =
  | z.infer<typeof extractionSchema>
  | z.infer<typeof drawingExtractionSchema>;

/** "drawing" when the row's evidence pages are in the package drawing. */
function evidenceDocumentOf(row: object): { evidenceDocument?: "drawing" } {
  return "evidenceFile" in row && row.evidenceFile === "drawing" ? { evidenceDocument: "drawing" } : {};
}

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
      ...evidenceDocumentOf(measurement),
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
      ...evidenceDocumentOf(pin),
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
  rules: { needsReview: boolean; notes: string[] } = { needsReview: false, notes: [] },
): ReviewSummary {
  const derivedNotes = new Set([...parsed.review.notes, ...rules.notes]);

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
      rules.needsReview ||
      measurements.some((measurement) => measurement.status === "needs_review") ||
      pins.some((pin) => pin.confidence === "low") ||
      parsed.packageSelection.confidence === "low",
    notes: Array.from(derivedNotes),
  };
}

const V1_DEVELOPER_MESSAGE =
  "You extract datasheet measurements and pin maps into a strict schema. Never invent values. Use not_found or needs_review instead of guessing silently.";

/** The original prompt, kept as v1 so the scoring script can compare against it. */
function buildPromptV1(input: ExtractionInput) {
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
    "- Evidence pages must be 1-based physical page indexes of the PDF file, not printed page labels.",
  ].join("\n");
}

/** Added to either prompt when a package drawing is attached as the second file. */
export const DRAWING_PROMPT = [
  "",
  "Two PDF files are attached: first the datasheet, then the package drawing (the outline with the package dimensions) for this part.",
  "- Take package dimensions from the drawing when the datasheet doesn't give them, and from whichever shows them more completely when both do.",
  "- Take pin names and numbers from the datasheet; use the drawing only for the pad and pin layout.",
  "- For every measurement and pin, set evidenceFile to \"datasheet\" or \"drawing\": the file its evidence pages are in. Evidence pages are 1-based physical page indexes within that file.",
].join("\n");

function buildMessages(input: ExtractionInput, version: ExtractionPromptVersion) {
  const drawing = input.drawing ? DRAWING_PROMPT : "";

  return version === "v2"
    ? {
        developer: RULEBOOK_DEVELOPER_MESSAGE,
        prompt: buildRulebookPrompt(input) + drawing,
      }
    : {
        developer: V1_DEVELOPER_MESSAGE,
        prompt: buildPromptV1(input) + drawing,
      };
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

function buildProviderUsage(
  usage: OpenAI.Responses.ResponseUsage | undefined,
): ProviderUsage | null {
  if (!usage) {
    return null;
  }

  return {
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

function buildProviderMeta(
  input: ExtractionInput,
  response: OpenAI.Responses.Response,
  latencyMs: number,
  promptVersion: ExtractionPromptVersion,
): ProviderMeta {
  const usage = buildProviderUsage(response.usage);
  const estimatedCostUsd = usage ? estimateExtractionCostUsd(input.model, usage) : null;

  return {
    latencyMs: Math.round(latencyMs),
    model: input.model,
    promptVersion,
    provider: "openai",
    reasoningEffort: input.reasoningEffort,
    responseId: response.id,
    ...(usage ? { usage } : {}),
    ...(estimatedCostUsd !== null ? { estimatedCostUsd } : {}),
  };
}

async function runWithDeadline<T>(
  signals: { caller?: AbortSignal; deadline: AbortSignal },
  operation: () => Promise<T>,
): Promise<T> {
  if (signals.caller?.aborted) {
    throw new ExtractionCancelledError();
  }

  try {
    return await operation();
  } catch (error) {
    // Check the caller first: a cancel that races the deadline is still a cancel.
    if (signals.caller?.aborted) {
      throw new ExtractionCancelledError();
    }

    if (signals.deadline.aborted) {
      throw new ExtractionTimeoutError(EXTRACTION_REQUEST_TIMEOUT_MS);
    }

    throw error;
  }
}

export class OpenAIExtractionProvider implements AiProvider {
  async extractDatasheet(input: ExtractionInput): Promise<ExtractionResult> {
    const promptVersion = input.promptVersion ?? DEFAULT_EXTRACTION_PROMPT_VERSION;
    const messages = buildMessages(input, promptVersion);
    const base64Pdf = Buffer.from(input.pdfBytes).toString("base64");
    const drawingFile = input.drawing
      ? [
          {
            file_data: `data:application/pdf;base64,${Buffer.from(input.drawing.pdfBytes).toString("base64")}`,
            filename: input.drawing.pdfFileName,
            type: "input_file" as const,
          },
        ]
      : [];
    const deadlineSignal = AbortSignal.timeout(EXTRACTION_REQUEST_TIMEOUT_MS);
    const requestSignal = input.signal
      ? AbortSignal.any([input.signal, deadlineSignal])
      : deadlineSignal;
    const startedAt = performance.now();
    const response = await runWithDeadline({ caller: input.signal, deadline: deadlineSignal }, () =>
      getOpenAIClient().responses.parse(
        {
          model: input.model,
          reasoning: {
            effort: input.reasoningEffort,
          },
          input: [
            {
              role: "developer",
              content: messages.developer,
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: messages.prompt,
                },
                {
                  type: "input_file",
                  filename: input.pdfFileName,
                  file_data: `data:application/pdf;base64,${base64Pdf}`,
                },
                ...drawingFile,
              ],
            },
          ],
          text: {
            format: input.drawing
              ? zodTextFormat(drawingExtractionSchema, "datasheet_extraction")
              : zodTextFormat(extractionSchema, "datasheet_extraction"),
            verbosity: "low",
          },
        },
        {
          signal: requestSignal,
          timeout: EXTRACTION_REQUEST_TIMEOUT_MS,
        },
      ),
    );
    const latencyMs = performance.now() - startedAt;
    const parsed = response.output_parsed;

    if (!parsed) {
      throw new Error("OpenAI returned an empty extraction payload.");
    }

    const packageSelection = buildPackageSelection(parsed.packageSelection);
    let measurements = normalizeMeasurements(input.requestedFields, parsed.measurements);
    let pins = normalizePins(parsed.pins);
    let rules = { needsReview: false, notes: [] as string[] };

    if (promptVersion === "v2") {
      const outcome = applyExtractionRules({
        aiNotes: parsed.review.notes,
        measurements,
        packageCategory: input.packageCategory,
        pins,
        selectedPackage: packageSelection.selectedPackage,
      });

      measurements = outcome.measurements;
      pins = outcome.pins;
      rules = { needsReview: outcome.needsReview, notes: outcome.notes };
    }

    const review = buildReviewSummary(parsed, measurements, pins, rules);

    return {
      measurements,
      packageSelection,
      pins,
      providerMeta: buildProviderMeta(input, response, latencyMs, promptVersion),
      review,
    };
  }
}
