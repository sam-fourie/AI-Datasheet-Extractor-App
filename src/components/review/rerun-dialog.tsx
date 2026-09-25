"use client";

import { useState } from "react";

import { Badge, Button, Callout, Dialog, SegmentedControl, cn } from "@/components/ui";
import {
  formatModelPricing,
  getOpenAIModelDefinition,
  OPENAI_MODELS,
  REASONING_EFFORT_LABELS,
  type OpenAIModelRole,
  type OpenAIReasoningEffort,
} from "@/lib/ai/models";
import type { SubmissionModelRun } from "@/lib/submissions/types";

import type { RerunSettings } from "./review-services";
import { indexRunsByModelEffort } from "./workspace-model";

const ROLE_LABELS: Record<OpenAIModelRole, string> = {
  budget: "Budget",
  candidate: "Candidate",
  control: "Control",
  default: "Default",
  premium: "Premium",
};

export type RerunDialogProps = {
  /** The baseline is fully reviewed (else agreement compares raw AI output). */
  baselineReviewed: boolean;
  defaultModel: string;
  defaultReasoningEffort: string;
  onClose: () => void;
  onStart: (settings: RerunSettings) => void;
  open: boolean;
  partNumber: string;
  runs: readonly SubmissionModelRun[];
  variant?: "center" | "sheet-bottom";
};

function pickEffort(model: string, preferred: string): OpenAIReasoningEffort {
  const definition = getOpenAIModelDefinition(model);

  if (!definition) {
    return "high";
  }

  return (definition.supportedEfforts as readonly string[]).includes(preferred)
    ? (preferred as OpenAIReasoningEffort)
    : definition.defaultEffort;
}

/**
 * "Run another model" (§5.8): model cards with role, description and list
 * price, an effort control limited to the model's efforts, and the baseline
 * note. Start run closes the dialog; the workspace starts a background task.
 */
export function RerunDialog({
  baselineReviewed,
  defaultModel,
  defaultReasoningEffort,
  onClose,
  onStart,
  open,
  partNumber,
  runs,
  variant = "center",
}: RerunDialogProps) {
  const initialModel = getOpenAIModelDefinition(defaultModel)?.id ?? OPENAI_MODELS[0].id;
  const [model, setModel] = useState<string>(initialModel);
  const [effort, setEffort] = useState<OpenAIReasoningEffort>(() =>
    pickEffort(initialModel, defaultReasoningEffort),
  );
  const definition = getOpenAIModelDefinition(model) ?? OPENAI_MODELS[0];
  const done = indexRunsByModelEffort(runs);

  function selectModel(next: string) {
    setModel(next);
    setEffort((current) => pickEffort(next, current));
  }

  return (
    <Dialog
      description={`Re-extract ${partNumber} from the saved PDF and score it against the baseline's latest review.`}
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => onStart({ model, reasoningEffort: effort })} variant="primary">
            Start run
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="md"
      title="Run another model"
      variant={variant}
    >
      <div className="space-y-5 pb-1">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-callout font-medium text-text">Model</legend>
          {OPENAI_MODELS.map((option) => {
            const status = done.get(`${option.id}|${effort}`);
            const checked = option.id === model;

            return (
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-sm border px-3 py-2.5 transition-colors duration-(--ui-duration-fast) ease-ui has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  checked
                    ? "border-accent bg-surface-selected"
                    : "border-border-strong hover:bg-surface-hover",
                )}
                key={option.id}
              >
                <input
                  checked={checked}
                  className="mt-0.5 size-4 shrink-0 accent-(--ui-accent) outline-none"
                  name="rerun-model"
                  onChange={() => selectModel(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body font-medium text-text">{option.label}</span>
                    <Badge size="sm" tone={option.role === "default" ? "accent" : "neutral"}>
                      {ROLE_LABELS[option.role]}
                    </Badge>
                    {status ? (
                      <Badge size="sm" tone="neutral">
                        {status.label}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-callout text-text-muted">{option.description}</span>
                  <span className="mt-0.5 block text-caption text-text-muted tabular-nums">
                    {formatModelPricing(option.pricing)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="space-y-2">
          <p className="text-callout font-medium text-text" id="rerun-effort-label">
            Reasoning effort
          </p>
          <SegmentedControl<OpenAIReasoningEffort>
            aria-label="Reasoning effort"
            onChange={setEffort}
            options={definition.supportedEfforts.map((value) => ({
              label: REASONING_EFFORT_LABELS[value],
              value,
            }))}
            size="sm"
            value={effort}
          />
        </div>

        {baselineReviewed ? null : (
          <Callout tone="warning">
            The baseline isn&apos;t reviewed yet, so agreement compares against its raw AI output.
          </Callout>
        )}

        <p className="text-caption text-text-muted">Usually 10 to 50 s. Stops after 4 minutes.</p>
      </div>
    </Dialog>
  );
}
