"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button, Card, Spinner } from "@/components/ui";
import {
  getOpenAIModelDefinition,
  REASONING_EFFORT_LABELS,
  type OpenAIModelId,
  type OpenAIReasoningEffort,
} from "@/lib/ai/models";
import { PACKAGE_CATEGORY_FIELDS, type PackageCategory } from "@/lib/package-categories";
import { getUrlHost, normalizePartNumberKey } from "@/lib/submissions/source";
import type { DatasheetIndexEntry } from "@/lib/submissions/types";

import { DatasheetSourceField } from "./datasheet-source-field";
import { DuplicateNotice } from "./duplicate-notice";
import {
  ExtractionErrorCallout,
  type ExtractionErrorAction,
} from "./extraction-error-callout";
import { ExtractionProgress } from "./extraction-progress";
import {
  findModelEstimate,
  getFileValidationError,
  suggestPartNumberFromFileName,
  type ExtractionRequestInput,
  type ModelRunEstimate,
  type SourceKind,
} from "./intake-helpers";
import { ModelSettings } from "./model-settings";
import { PACKAGE_CATEGORY_INPUT_ID, PackageCategoryField } from "./package-category-field";
import { PartNumberField } from "./part-number-field";
import { useExtractionRequest } from "./use-extraction-request";
import { useUrlValidation } from "./use-url-validation";

export type NewExtractionFormProps = {
  defaultModel: OpenAIModelId;
  defaultReasoningEffort: OpenAIReasoningEffort;
  /** Per model and effort latency/cost benchmarks; null when they failed to load. */
  estimates: readonly ModelRunEstimate[] | null;
  /** Baseline index for duplicate detection and "Recently used"; null when it failed to load. */
  index: readonly DatasheetIndexEntry[] | null;
};

const EFFORTS_ABOVE_MEDIUM: readonly OpenAIReasoningEffort[] = ["high", "xhigh", "max"];

function resolveActiveSource(
  lastEdited: SourceKind | null,
  hasFile: boolean,
  hasUrl: boolean,
): SourceKind | null {
  if (lastEdited === "url") {
    return hasUrl ? "url" : hasFile ? "upload" : null;
  }

  if (lastEdited === "upload") {
    return hasFile ? "upload" : hasUrl ? "url" : null;
  }

  return hasFile ? "upload" : hasUrl ? "url" : null;
}

/**
 * The New extraction form (spec §2.1 steps 1-7, §4.1). Inputs stay mounted
 * while the progress panel shows, so errors and cancels restore them intact.
 */
export function NewExtractionForm({
  defaultModel,
  defaultReasoningEffort,
  estimates,
  index,
}: NewExtractionFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [lastEdited, setLastEdited] = useState<SourceKind | null>(null);
  const [partNumber, setPartNumber] = useState("");
  const [category, setCategory] = useState<PackageCategory | null>(null);
  const [model, setModel] = useState<OpenAIModelId>(defaultModel);
  const [reasoningEffort, setReasoningEffort] =
    useState<OpenAIReasoningEffort>(defaultReasoningEffort);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<string | null>(null);
  const [queuedSubmit, setQueuedSubmit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const partNumberRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const urlValidation = useUrlValidation(url);
  const { cancel, clearError, start, state } = useExtractionRequest();
  const { phase } = state;
  const isBusy = phase === "uploading" || phase === "extracting" || phase === "opening";

  const trimmedUrl = url.trim();
  const activeSource = resolveActiveSource(lastEdited, file !== null, trimmedUrl.length > 0);
  const fileError = getFileValidationError(file);
  const trimmedPartNumber = partNumber.trim();
  const fieldCount = category ? PACKAGE_CATEGORY_FIELDS[category].length : null;
  const isIncomplete = activeSource === null || !trimmedPartNumber || category === null;
  const isCheckingLink = activeSource === "url" && urlValidation.status === "checking";

  const missingSourceError =
    submitAttempted && activeSource === null ? "Add a datasheet PDF or paste a link." : null;
  const partNumberError = submitAttempted && !trimmedPartNumber ? "Enter a part number." : null;
  const categoryError = submitAttempted && category === null ? "Choose a package category." : null;

  const partNumberSuggestion = useMemo(() => {
    if (activeSource === "upload" && file) {
      return suggestPartNumberFromFileName(file.name);
    }

    if (activeSource === "url" && urlValidation.status === "valid") {
      return suggestPartNumberFromFileName(urlValidation.fileName);
    }

    return null;
  }, [activeSource, file, urlValidation]);

  const recentCategories = useMemo(() => {
    const seen: PackageCategory[] = [];

    for (const entry of index ?? []) {
      if (!seen.includes(entry.packageCategory)) {
        seen.push(entry.packageCategory);
      }

      if (seen.length === 3) {
        break;
      }
    }

    return seen;
  }, [index]);

  const duplicate = useMemo(() => {
    if (!index) {
      return null;
    }

    const partKey = normalizePartNumberKey(partNumber);
    const activeUrl = activeSource === "url" ? trimmedUrl : null;

    return (
      index.find(
        (entry) =>
          (partKey.length > 0 && entry.normalizedPartNumber === partKey) ||
          (activeUrl !== null && entry.normalizedUrl === activeUrl),
      ) ?? null
    );
  }, [activeSource, index, partNumber, trimmedUrl]);

  const showDuplicate =
    duplicate !== null && duplicate.submissionId !== dismissedDuplicateId;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function focusFirstInvalid(): boolean {
    if (activeSource === null || (activeSource === "upload" && fileError)) {
      browseButtonRef.current?.focus();
      return true;
    }

    if (
      activeSource === "url" &&
      (urlValidation.status === "malformed" || urlValidation.status === "invalid")
    ) {
      urlInputRef.current?.focus();
      return true;
    }

    if (!trimmedPartNumber) {
      partNumberRef.current?.focus();
      return true;
    }

    if (category === null) {
      document.getElementById(PACKAGE_CATEGORY_INPUT_ID)?.focus();
      return true;
    }

    return false;
  }

  function submit(overrides?: { reasoningEffort?: OpenAIReasoningEffort }) {
    setSubmitAttempted(true);
    setQueuedSubmit(false);

    if (focusFirstInvalid() || activeSource === null || category === null) {
      return;
    }

    if (activeSource === "url" && urlValidation.status === "checking") {
      setQueuedSubmit(true);
      return;
    }

    const input: ExtractionRequestInput = {
      model,
      packageCategory: category,
      partNumber: trimmedPartNumber,
      reasoningEffort: overrides?.reasoningEffort ?? reasoningEffort,
      source:
        activeSource === "upload" && file
          ? { file, kind: "upload" }
          : { kind: "url", url: trimmedUrl },
    };

    if (trimmedPartNumber !== partNumber) {
      setPartNumber(trimmedPartNumber);
    }

    void start(input);
  }

  // "Extract" pressed while the link was still being checked: continue once the check settles.
  const submitRef = useRef(submit);

  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (queuedSubmit && !isCheckingLink) {
      submitRef.current();
    }
  }, [isCheckingLink, queuedSubmit]);

  // After a cancel the form comes back; put focus somewhere sensible.
  useEffect(() => {
    if (phase === "cancelled") {
      submitButtonRef.current?.focus();
    }
  }, [phase]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleModelChange(nextModel: OpenAIModelId) {
    const definition = getOpenAIModelDefinition(nextModel);

    setModel(nextModel);

    if (!definition.supportedEfforts.includes(reasoningEffort)) {
      setReasoningEffort(definition.defaultEffort);
    }
  }

  function handleErrorAction(action: ExtractionErrorAction) {
    switch (action) {
      case "try-again":
        submit();
        return;
      case "upload-instead":
        clearError();
        setLastEdited("upload");

        if (file) {
          browseButtonRef.current?.focus();
        } else {
          openFilePicker();
        }
        return;
      case "choose-file":
        clearError();
        setLastEdited("upload");
        openFilePicker();
        return;
      case "retry-medium":
        setReasoningEffort("medium");
        submit({ reasoningEffort: "medium" });
        return;
    }
  }

  const failedInput = state.input;
  const canRetryAtMedium =
    failedInput !== null &&
    getOpenAIModelDefinition(failedInput.model).supportedEfforts.includes("medium") &&
    EFFORTS_ABOVE_MEDIUM.includes(failedInput.reasoningEffort);

  const progressMeta = failedInput
    ? [
        failedInput.packageCategory,
        failedInput.source.kind === "upload"
          ? failedInput.source.file.name
          : urlValidation.status === "valid" && urlValidation.url === failedInput.source.url
            ? urlValidation.fileName
            : (getUrlHost(failedInput.source.url) ?? failedInput.source.url),
        getOpenAIModelDefinition(failedInput.model).label,
        REASONING_EFFORT_LABELS[failedInput.reasoningEffort],
      ].join(" · ")
    : "";

  const submitLabel = isCheckingLink
    ? "Checking link…"
    : fieldCount !== null
      ? `Extract ${fieldCount} fields`
      : "Extract";

  return (
    <Card padding="lg">
      {isBusy && failedInput ? (
        <ExtractionProgress
          estimate={findModelEstimate(estimates, failedInput.model, failedInput.reasoningEffort)}
          key={`${failedInput.partNumber}-${failedInput.reasoningEffort}-${failedInput.model}`}
          meta={progressMeta}
          onCancel={cancel}
          partNumber={failedInput.partNumber}
          state={state}
        />
      ) : null}

      <div className="space-y-6" hidden={isBusy}>
        {phase === "error" && state.error ? (
          <ExtractionErrorCallout
            canRetryAtMedium={canRetryAtMedium}
            failure={state.error}
            onAction={handleErrorAction}
            onDismiss={clearError}
          />
        ) : null}

        <form
          aria-label="New extraction"
          className="animate-fade-in space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <DatasheetSourceField
            activeSource={activeSource}
            browseButtonRef={browseButtonRef}
            file={file}
            fileError={fileError}
            fileInputRef={fileInputRef}
            missingError={missingSourceError}
            onActivate={setLastEdited}
            onFileChange={(nextFile) => {
              setFile(nextFile);
              setLastEdited(nextFile ? "upload" : lastEdited === "upload" ? null : lastEdited);
            }}
            onUrlChange={(nextUrl) => {
              setUrl(nextUrl);
              setLastEdited(nextUrl.trim() ? "url" : lastEdited === "url" ? null : lastEdited);
            }}
            showUrlErrors={submitAttempted}
            url={url}
            urlInputRef={urlInputRef}
            urlValidation={urlValidation}
          />

          <PartNumberField
            error={partNumberError}
            inputRef={partNumberRef}
            notice={
              showDuplicate && duplicate ? (
                <DuplicateNotice
                  entry={duplicate}
                  matchedBy={
                    duplicate.normalizedPartNumber === normalizePartNumberKey(partNumber)
                      ? "partNumber"
                      : "url"
                  }
                  model={model}
                  onDismiss={() => setDismissedDuplicateId(duplicate.submissionId)}
                  reasoningEffort={reasoningEffort}
                />
              ) : null
            }
            onChange={setPartNumber}
            suggestion={partNumberSuggestion}
            value={partNumber}
          />

          <PackageCategoryField
            error={categoryError}
            onChange={setCategory}
            recentCategories={recentCategories}
            value={category}
          />

          <div className="border-t border-border-subtle pt-5">
            <ModelSettings
              estimates={estimates}
              model={model}
              onModelChange={handleModelChange}
              onReasoningEffortChange={setReasoningEffort}
              reasoningEffort={reasoningEffort}
            />
          </div>

          <div className="space-y-3 pt-1">
            {isIncomplete ? (
              <p className="text-callout text-text-muted">
                Add a datasheet, part number and package category.
              </p>
            ) : null}
            <Button
              aria-busy={queuedSubmit && isCheckingLink ? true : undefined}
              className="w-full"
              ref={submitButtonRef}
              size="lg"
              type="submit"
              variant="primary"
            >
              {isCheckingLink ? <Spinner /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
