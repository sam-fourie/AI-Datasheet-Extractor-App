import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_REASONING_EFFORT,
  getOpenAIModelDefinition,
  isOpenAIModelId,
  isOpenAIReasoningEffort,
  type OpenAIModelId,
  type OpenAIReasoningEffort,
} from "@/lib/ai/models";

/**
 * Server-side resolution of which model and reasoning effort to use.
 * Defaults come from `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT`, and a
 * request may override either as long as the values are in the allowlist.
 */

export type ExtractionSettings = {
  model: OpenAIModelId;
  reasoningEffort: OpenAIReasoningEffort;
};

export class ExtractionSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionSettingsError";
  }
}

const INVALID_MODEL_MESSAGE = "Please choose a supported AI model.";
const INVALID_EFFORT_MESSAGE = "Please choose a supported reasoning effort.";

let cachedDefaults: ExtractionSettings | null = null;

function readEnvValue(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function resolveDefaultModel(): OpenAIModelId {
  const configured = readEnvValue("OPENAI_MODEL");

  if (!configured) {
    return DEFAULT_OPENAI_MODEL;
  }

  if (isOpenAIModelId(configured)) {
    return configured;
  }

  console.warn(
    `OPENAI_MODEL="${configured}" is not in the model allowlist. Falling back to ${DEFAULT_OPENAI_MODEL}.`,
  );

  return DEFAULT_OPENAI_MODEL;
}

function resolveDefaultReasoningEffort(model: OpenAIModelId): OpenAIReasoningEffort {
  const definition = getOpenAIModelDefinition(model);
  const fallback = definition.supportedEfforts.includes(DEFAULT_REASONING_EFFORT)
    ? DEFAULT_REASONING_EFFORT
    : definition.defaultEffort;
  const configured = readEnvValue("OPENAI_REASONING_EFFORT");

  if (!configured) {
    return fallback;
  }

  if (
    isOpenAIReasoningEffort(configured) &&
    definition.supportedEfforts.includes(configured)
  ) {
    return configured;
  }

  console.warn(
    `OPENAI_REASONING_EFFORT="${configured}" is not supported by ${model}. Falling back to ${fallback}.`,
  );

  return fallback;
}

export function getDefaultExtractionSettings(): ExtractionSettings {
  if (!cachedDefaults) {
    const model = resolveDefaultModel();

    cachedDefaults = {
      model,
      reasoningEffort: resolveDefaultReasoningEffort(model),
    };
  }

  return cachedDefaults;
}

function readOptionalString(value: unknown, message: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ExtractionSettingsError(message);
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function resolveExtractionSettings(input: {
  model?: unknown;
  reasoningEffort?: unknown;
}): ExtractionSettings {
  const defaults = getDefaultExtractionSettings();
  const requestedModel = readOptionalString(input.model, INVALID_MODEL_MESSAGE);
  const requestedEffort = readOptionalString(
    input.reasoningEffort,
    INVALID_EFFORT_MESSAGE,
  );

  let model = defaults.model;

  if (requestedModel !== undefined) {
    if (!isOpenAIModelId(requestedModel)) {
      throw new ExtractionSettingsError(INVALID_MODEL_MESSAGE);
    }

    model = requestedModel;
  }

  const definition = getOpenAIModelDefinition(model);
  let reasoningEffort =
    model === defaults.model ? defaults.reasoningEffort : definition.defaultEffort;

  if (requestedEffort !== undefined) {
    if (!isOpenAIReasoningEffort(requestedEffort)) {
      throw new ExtractionSettingsError(INVALID_EFFORT_MESSAGE);
    }

    reasoningEffort = requestedEffort;
  }

  if (!definition.supportedEfforts.includes(reasoningEffort)) {
    throw new ExtractionSettingsError(
      `${definition.label} does not support ${reasoningEffort} reasoning effort.`,
    );
  }

  return {
    model,
    reasoningEffort,
  };
}
