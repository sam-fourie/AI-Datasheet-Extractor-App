"use client";

import { useId, useState } from "react";

import { Badge, Button, cn, SegmentedControl, type BadgeTone } from "@/components/ui";
import {
  formatModelPricing,
  getOpenAIModelDefinition,
  OPENAI_MODELS,
  REASONING_EFFORT_LABELS,
  type OpenAIModelId,
  type OpenAIModelRole,
  type OpenAIReasoningEffort,
} from "@/lib/ai/models";

import { describeModelEstimate, type ModelRunEstimate } from "./intake-helpers";

export type ModelSettingsProps = {
  estimates: readonly ModelRunEstimate[] | null;
  model: OpenAIModelId;
  onModelChange: (model: OpenAIModelId) => void;
  onReasoningEffortChange: (effort: OpenAIReasoningEffort) => void;
  reasoningEffort: OpenAIReasoningEffort;
};

const ROLE_LABELS: Record<OpenAIModelRole, string> = {
  budget: "Budget",
  candidate: "Candidate",
  control: "Control",
  default: "Default",
  premium: "Premium",
};

const ROLE_TONES: Record<OpenAIModelRole, BadgeTone> = {
  budget: "neutral",
  candidate: "neutral",
  control: "neutral",
  default: "accent",
  premium: "neutral",
};

/**
 * Model summary row ("GPT-5.6 Terra · High effort ~20 s · ~$0.220 per
 * datasheet  Change") with a disclosure holding the model radio cards and the
 * effort control, limited to the model's supported efforts.
 */
export function ModelSettings({
  estimates,
  model,
  onModelChange,
  onReasoningEffortChange,
  reasoningEffort,
}: ModelSettingsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const definition = getOpenAIModelDefinition(model);
  const summaryEstimate = describeModelEstimate(estimates, model, reasoningEffort);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-callout font-medium text-text">Model</span>
        <span className="min-w-0 text-body font-medium text-text">
          {definition.label} · {REASONING_EFFORT_LABELS[reasoningEffort]} effort
        </span>
        {summaryEstimate ? (
          <span className="text-callout text-text-muted tabular-nums">
            {summaryEstimate}
          </span>
        ) : null}
        <Button
          aria-controls={panelId}
          aria-expanded={open}
          className="ml-auto"
          onClick={() => setOpen((current) => !current)}
          size="sm"
          variant="plain"
        >
          {open ? "Done" : "Change"}
          <span className="sr-only"> model settings</span>
        </Button>
      </div>

      <div className="animate-fade-in space-y-4" hidden={!open} id={panelId}>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-1.5 text-callout font-medium text-text">AI model</legend>
          {OPENAI_MODELS.map((option) => {
            const effortForEstimate = option.supportedEfforts.includes(reasoningEffort)
              ? reasoningEffort
              : option.defaultEffort;
            const estimate = describeModelEstimate(estimates, option.id, effortForEstimate);
            const checked = option.id === model;

            return (
              <label
                className={cn(
                  "relative flex min-w-0 cursor-pointer flex-col gap-1 rounded-sm border px-3 py-2.5 transition-colors duration-(--ui-duration-fast) ease-ui has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  checked
                    ? "border-accent bg-surface-selected"
                    : "border-border hover:bg-surface-hover",
                )}
                key={option.id}
              >
                <input
                  checked={checked}
                  className="sr-only"
                  name="model"
                  onChange={() => onModelChange(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-body font-medium text-text">{option.label}</span>
                  <Badge size="sm" tone={ROLE_TONES[option.role]}>
                    {ROLE_LABELS[option.role]}
                  </Badge>
                  {estimate ? (
                    <span className="ml-auto text-callout text-text-muted tabular-nums">
                      {estimate}
                    </span>
                  ) : null}
                </span>
                <span className="text-callout text-text-muted">{option.description}</span>
                <span className="text-caption text-text-muted">
                  <span className="font-mono">{option.id}</span> ·{" "}
                  {formatModelPricing(option.pricing)}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="min-w-0 space-y-1.5">
          <p className="text-callout font-medium text-text" id={`${panelId}-effort`}>
            Reasoning effort
          </p>
          <SegmentedControl
            aria-label="Reasoning effort"
            onChange={onReasoningEffortChange}
            options={definition.supportedEfforts.map((effort) => ({
              label: REASONING_EFFORT_LABELS[effort],
              value: effort,
            }))}
            value={reasoningEffort}
          />
          <p className="text-caption text-text-muted">
            Higher effort helps with dense drawings but takes longer.
          </p>
        </div>
      </div>
    </div>
  );
}
