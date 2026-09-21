import type { ProviderUsage } from "@/lib/package-categories";

/**
 * Client-safe catalog of the OpenAI models this app is allowed to call.
 * Keep pricing, effort support, and labels here so the intake form, the
 * extraction route, and the provider all agree. Server-side defaults are
 * resolved in `src/lib/ai/settings.ts`.
 */

export const OPENAI_REASONING_EFFORTS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type OpenAIReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];

export const REASONING_EFFORT_LABELS: Record<OpenAIReasoningEffort, string> = {
  high: "High",
  low: "Low",
  max: "Max",
  medium: "Medium",
  xhigh: "Extra high",
};

export const OPENAI_MODEL_IDS = [
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.4",
  "gpt-5.6-luna",
  "gpt-6-astra",
] as const;

export type OpenAIModelId = (typeof OPENAI_MODEL_IDS)[number];

export type OpenAIModelRole =
  | "budget"
  | "candidate"
  | "control"
  | "default"
  | "premium";

/** USD per one million tokens at OpenAI's standard (non-batch) tier. */
export type OpenAIModelPricing = {
  cachedInputPerMillion: number;
  inputPerMillion: number;
  outputPerMillion: number;
};

export type OpenAIModelDefinition = {
  defaultEffort: OpenAIReasoningEffort;
  description: string;
  id: OpenAIModelId;
  label: string;
  pricing: OpenAIModelPricing;
  role: OpenAIModelRole;
  supportedEfforts: readonly OpenAIReasoningEffort[];
};

export const DEFAULT_OPENAI_MODEL: OpenAIModelId = "gpt-5.6-terra";

export const DEFAULT_REASONING_EFFORT: OpenAIReasoningEffort = "medium";

/**
 * Hard deadline for one model call. The extraction route allows 300 seconds in
 * total, so this leaves room for fetching the PDF and persisting the result.
 */
export const EXTRACTION_REQUEST_TIMEOUT_MS = 240_000;

const FULL_EFFORT_RANGE: readonly OpenAIReasoningEffort[] = OPENAI_REASONING_EFFORTS;

const GPT_5_4_EFFORTS: readonly OpenAIReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
];

const ASTRA_EFFORTS: readonly OpenAIReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

const MODEL_DEFINITIONS: Record<OpenAIModelId, Omit<OpenAIModelDefinition, "id">> = {
  "gpt-5.4": {
    defaultEffort: "medium",
    description:
      "Previous default. Keep it as the control when comparing newer models.",
    label: "GPT-5.4",
    pricing: {
      cachedInputPerMillion: 0.25,
      inputPerMillion: 2.5,
      outputPerMillion: 15,
    },
    role: "control",
    supportedEfforts: GPT_5_4_EFFORTS,
  },
  "gpt-5.6-luna": {
    defaultEffort: "medium",
    description: "Budget tier at roughly a tenth of Terra's price.",
    label: "GPT-5.6 Luna",
    pricing: {
      cachedInputPerMillion: 0.02,
      inputPerMillion: 0.2,
      outputPerMillion: 1.2,
    },
    role: "budget",
    supportedEfforts: FULL_EFFORT_RANGE,
  },
  "gpt-5.6-sol": {
    defaultEffort: "medium",
    description:
      "Flagship GPT-5.6. Accuracy candidate at about twice Terra's price.",
    label: "GPT-5.6 Sol",
    pricing: {
      cachedInputPerMillion: 0.4,
      inputPerMillion: 4,
      outputPerMillion: 20,
    },
    role: "candidate",
    supportedEfforts: FULL_EFFORT_RANGE,
  },
  "gpt-5.6-terra": {
    defaultEffort: "medium",
    description:
      "Default. GPT-5.5-class accuracy at a lower price than GPT-5.4.",
    label: "GPT-5.6 Terra",
    pricing: {
      cachedInputPerMillion: 0.2,
      inputPerMillion: 2,
      outputPerMillion: 12,
    },
    role: "default",
    supportedEfforts: FULL_EFFORT_RANGE,
  },
  "gpt-6-astra": {
    defaultEffort: "medium",
    description:
      "Most capable and most expensive. Built for agentic work rather than documents.",
    label: "GPT-6 Astra",
    pricing: {
      cachedInputPerMillion: 1,
      inputPerMillion: 10,
      outputPerMillion: 50,
    },
    role: "premium",
    supportedEfforts: ASTRA_EFFORTS,
  },
};

export const OPENAI_MODELS: readonly OpenAIModelDefinition[] = OPENAI_MODEL_IDS.map(
  (id) => ({
    id,
    ...MODEL_DEFINITIONS[id],
  }),
);

export function isOpenAIModelId(value: string): value is OpenAIModelId {
  return (OPENAI_MODEL_IDS as readonly string[]).includes(value);
}

export function isOpenAIReasoningEffort(
  value: string,
): value is OpenAIReasoningEffort {
  return (OPENAI_REASONING_EFFORTS as readonly string[]).includes(value);
}

export function getOpenAIModelDefinition(
  modelId: OpenAIModelId,
): OpenAIModelDefinition;
export function getOpenAIModelDefinition(
  modelId: string,
): OpenAIModelDefinition | null;
export function getOpenAIModelDefinition(modelId: string) {
  return OPENAI_MODELS.find((model) => model.id === modelId) ?? null;
}

function formatPrice(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function formatModelPricing(pricing: OpenAIModelPricing) {
  return `$${formatPrice(pricing.inputPerMillion)} in / $${formatPrice(pricing.outputPerMillion)} out per 1M tokens`;
}

/**
 * Estimates the cost of one run at standard-tier list prices. Cache writes and
 * the long-context premium above 272K input tokens are not modelled.
 */
export function estimateExtractionCostUsd(
  modelId: string,
  usage: ProviderUsage,
): number | null {
  const definition = getOpenAIModelDefinition(modelId);

  if (!definition) {
    return null;
  }

  const cachedInputTokens = Math.max(usage.cachedInputTokens, 0);
  const uncachedInputTokens = Math.max(usage.inputTokens - cachedInputTokens, 0);
  const outputTokens = Math.max(usage.outputTokens, 0);
  const costUsd =
    (uncachedInputTokens * definition.pricing.inputPerMillion +
      cachedInputTokens * definition.pricing.cachedInputPerMillion +
      outputTokens * definition.pricing.outputPerMillion) /
    1_000_000;

  return Math.round(costUsd * 10_000) / 10_000;
}
