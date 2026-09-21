"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useNavigationBlocker } from "@/components/navigation-blocker-provider";
import { Button, Card, Field, SelectField } from "@/components/ui";
import {
  EXTRACTION_REQUEST_TIMEOUT_MS,
  formatModelPricing,
  getOpenAIModelDefinition,
  OPENAI_MODELS,
  REASONING_EFFORT_LABELS,
  type OpenAIModelId,
  type OpenAIReasoningEffort,
} from "@/lib/ai/models";
import type { RerunRequestPayload } from "@/lib/extractions";
import { hasRetainedUploadSource } from "@/lib/submissions/source";
import type { SubmissionDetail } from "@/lib/submissions/types";

const REASONING_EFFORT_HINT = `Higher effort helps with dense drawings but takes longer. Requests stop after ${Math.round(EXTRACTION_REQUEST_TIMEOUT_MS / 1000)} seconds.`;

type ErrorResponse = {
  error?: string;
};

type SubmissionRerunPanelProps = {
  defaultModel: OpenAIModelId;
  defaultReasoningEffort: OpenAIReasoningEffort;
  submission: SubmissionDetail;
};

function pickInitialModel(defaultModel: OpenAIModelId, currentModel: string) {
  if (defaultModel !== currentModel) {
    return defaultModel;
  }

  return OPENAI_MODELS.find((model) => model.id !== currentModel)?.id ?? defaultModel;
}

function pickSupportedEffort(model: OpenAIModelId, effort: OpenAIReasoningEffort) {
  const definition = getOpenAIModelDefinition(model);

  return definition.supportedEfforts.includes(effort) ? effort : definition.defaultEffort;
}

export function SubmissionRerunPanel({
  defaultModel,
  defaultReasoningEffort,
  submission,
}: SubmissionRerunPanelProps) {
  const router = useRouter();
  const { setIsBlocked } = useNavigationBlocker();
  const [selectedModel, setSelectedModel] = useState<OpenAIModelId>(() =>
    pickInitialModel(defaultModel, submission.providerMeta.model),
  );
  const [reasoningEffort, setReasoningEffort] = useState<OpenAIReasoningEffort>(() =>
    pickSupportedEffort(
      pickInitialModel(defaultModel, submission.providerMeta.model),
      defaultReasoningEffort,
    ),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const selectedModelDefinition = getOpenAIModelDefinition(selectedModel);
  const modelHint = `${selectedModelDefinition.description} ${formatModelPricing(selectedModelDefinition.pricing)}.`;
  const sourceMeta = submission.intake.sourceMeta;
  const canRerun = sourceMeta.kind === "url" || hasRetainedUploadSource(sourceMeta);
  const isRerun = Boolean(submission.comparison);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    setIsBlocked(true);

    return () => {
      setIsBlocked(false);
    };
  }, [isRunning, setIsBlocked]);

  function handleModelChange(nextModel: OpenAIModelId) {
    setRunError(null);
    setSelectedModel(nextModel);
    setReasoningEffort((current) => pickSupportedEffort(nextModel, current));
  }

  async function handleRun() {
    setIsRunning(true);
    setRunError(null);

    try {
      const response = await fetch(
        `/api/submissions/${submission.submissionId}/rerun`,
        {
          body: JSON.stringify({
            model: selectedModel,
            reasoningEffort,
          } satisfies RerunRequestPayload),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | SubmissionDetail
        | ErrorResponse
        | null;

      if (!response.ok || !payload || !("submissionId" in payload)) {
        throw new Error(
          payload && "error" in payload
            ? payload.error || "The re-run failed."
            : "The re-run failed.",
        );
      }

      router.push(`/submissions/${payload.submissionId}`);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The re-run failed.");
      setIsRunning(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
          Model Comparison
        </p>
        <h3 className="text-2xl">Re-run this datasheet with another model</h3>
        <p className="max-w-3xl text-sm leading-6 text-text-muted">
          {isRerun
            ? "The same PDF and requested fields are sent again and the new run is compared with the original baseline."
            : "The same PDF and requested fields are sent again as a new submission that is compared with this one, so review this submission first to make the comparison meaningful."}
        </p>
      </div>

      {canRerun ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Field hint={modelHint} htmlFor="rerun-model" label="AI model">
              <SelectField
                disabled={isRunning}
                id="rerun-model"
                name="rerunModel"
                onChange={(event) =>
                  handleModelChange(event.currentTarget.value as OpenAIModelId)
                }
                value={selectedModel}
              >
                {OPENAI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.id}
                    {model.id === submission.providerMeta.model ? " · this run" : ""}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field
              hint={REASONING_EFFORT_HINT}
              htmlFor="rerun-reasoning-effort"
              label="Reasoning effort"
            >
              <SelectField
                disabled={isRunning}
                id="rerun-reasoning-effort"
                name="rerunReasoningEffort"
                onChange={(event) => {
                  setRunError(null);
                  setReasoningEffort(
                    event.currentTarget.value as OpenAIReasoningEffort,
                  );
                }}
                value={reasoningEffort}
              >
                {selectedModelDefinition.supportedEfforts.map((effort) => (
                  <option key={effort} value={effort}>
                    {REASONING_EFFORT_LABELS[effort]}
                  </option>
                ))}
              </SelectField>
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button disabled={isRunning} onClick={handleRun} variant="secondary">
              {isRunning ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent"
                  />
                  Running {selectedModelDefinition.label}...
                </span>
              ) : (
                `Run with ${selectedModelDefinition.label}`
              )}
            </Button>
            <p aria-live="polite" className="text-sm leading-6 text-text-muted">
              {isRunning
                ? "This can take a few minutes for long datasheets. You will be taken to the new run when it finishes."
                : "A new submission is created for the run and linked back here."}
            </p>
          </div>

          {runError ? (
            <div className="rounded-control border border-danger-ring bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-strong">
              {runError}
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-control border border-dashed border-border-strong bg-surface-muted px-4 py-5 text-sm leading-6 text-text-muted">
          The original PDF was not retained for this submission, so it cannot be
          re-run. Submit the datasheet again from the intake workbench to compare
          models.
        </div>
      )}
    </Card>
  );
}
