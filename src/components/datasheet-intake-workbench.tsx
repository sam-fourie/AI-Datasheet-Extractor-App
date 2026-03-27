"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useNavigationBlocker } from "@/components/navigation-blocker-provider";
import { SubmissionReviewEditor } from "@/components/submission-review-editor";
import {
  Button,
  Card,
  Field,
  FileField,
  SelectField,
  TextField,
} from "@/components/ui";
import {
  PACKAGE_CATEGORY_FIELDS,
  packageCategories,
  type PackageCategory,
  type SourceMode,
} from "@/lib/package-categories";
import type { SubmissionDetail } from "@/lib/submissions/types";

const sourceModes: Array<{
  label: string;
  value: SourceMode;
}> = [
  {
    value: "upload",
    label: "Upload PDF file",
  },
  {
    value: "url",
    label: "PDF URL",
  },
];

const URL_VALIDATION_DEBOUNCE_MS = 500;
const INVALID_PDF_URL_MESSAGE = "Datasheet URL must be a valid absolute URL.";
const IDLE_PDF_URL_MESSAGE =
  "Awaiting PDF validation. Enter a URL to check that it returns a PDF.";

type UrlValidationStatus = "checking" | "idle" | "invalid" | "valid";

type UrlValidationState = {
  checkedUrl: string | null;
  message: string | null;
  status: UrlValidationStatus;
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function createIdleUrlValidationState(): UrlValidationState {
  return {
    checkedUrl: null,
    message: null,
    status: "idle",
  };
}

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getUrlValidationTextClassName(status: UrlValidationStatus) {
  if (status === "checking") {
    return "text-accent";
  }

  if (status === "valid") {
    return "text-success-strong";
  }

  if (status === "invalid") {
    return "text-danger-strong";
  }

  return "text-text-muted";
}

function getUrlValidationAdornment(status: UrlValidationStatus) {
  if (status === "checking") {
    return (
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-accent"
      />
    );
  }

  if (status === "valid") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-5 items-center justify-center rounded-full bg-success-soft text-success-strong"
      >
        <svg
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 16 16"
        >
          <path d="m3.5 8.25 3 3 6-6" />
        </svg>
      </span>
    );
  }

  if (status === "invalid") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-5 items-center justify-center rounded-full bg-danger-soft text-danger-strong"
      >
        <svg
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 16 16"
        >
          <path d="M4.5 4.5 11.5 11.5" />
          <path d="M11.5 4.5 4.5 11.5" />
        </svg>
      </span>
    );
  }

  return undefined;
}

export function DatasheetIntakeWorkbench() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [selectedCategory, setSelectedCategory] = useState<PackageCategory | "">(
    "",
  );
  const [partNumber, setPartNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionDetail | null>(
    null,
  );
  const [urlValidation, setUrlValidation] = useState<UrlValidationState>(
    createIdleUrlValidationState,
  );
  const { setIsBlocked } = useNavigationBlocker();
  const liveOutputRef = useRef<HTMLDivElement | null>(null);
  const urlValidationAbortControllerRef = useRef<AbortController | null>(null);
  const urlValidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const trimmedPdfUrl = pdfUrl.trim();
  const submissionResultId = submissionResult?.submissionId;
  const previewFields = selectedCategory
    ? PACKAGE_CATEGORY_FIELDS[selectedCategory]
    : [];
  const hasValidatedPdfUrl =
    urlValidation.status === "valid" &&
    urlValidation.checkedUrl === trimmedPdfUrl;
  const hasActiveSource =
    sourceMode === "upload" ? selectedFile !== null : hasValidatedPdfUrl;
  const canSubmit =
    Boolean(selectedCategory) &&
    partNumber.trim().length > 0 &&
    hasActiveSource &&
    !isSubmitting;
  const liveRegionMessage = isSubmitting
    ? "Submitting to AI for extraction..."
    : submissionError
      ? submissionError
      : submissionResult
        ? "Extraction saved"
        : "";
  const urlValidationAdornment =
    sourceMode === "url"
      ? getUrlValidationAdornment(urlValidation.status)
      : undefined;
  const urlValidationMessage =
    sourceMode === "url"
      ? urlValidation.message ?? IDLE_PDF_URL_MESSAGE
      : null;
  const urlValidationHint =
    sourceMode === "url" && urlValidationMessage ? (
      <span
        aria-live="polite"
        className={[
          "font-medium",
          getUrlValidationTextClassName(urlValidation.status),
        ].join(" ")}
      >
        {urlValidationMessage}
      </span>
    ) : undefined;

  const cancelUrlValidation = useCallback(() => {
    if (urlValidationTimerRef.current !== null) {
      clearTimeout(urlValidationTimerRef.current);
      urlValidationTimerRef.current = null;
    }

    if (urlValidationAbortControllerRef.current) {
      urlValidationAbortControllerRef.current.abort();
      urlValidationAbortControllerRef.current = null;
    }
  }, []);

  const validatePdfUrl = useCallback(
    async (nextUrl: string) => {
      cancelUrlValidation();

      const abortController = new AbortController();

      urlValidationAbortControllerRef.current = abortController;
      setUrlValidation({
        checkedUrl: nextUrl,
        message: "Checking URL...",
        status: "checking",
      });

      try {
        const response = await fetch("/api/pdf-url-validation", {
          body: JSON.stringify({
            datasheetUrl: nextUrl,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
          signal: abortController.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; ok?: boolean }
          | null;

        if (urlValidationAbortControllerRef.current !== abortController) {
          return;
        }

        if (!response.ok) {
          setUrlValidation({
            checkedUrl: nextUrl,
            message: payload?.error || "Could not fetch the PDF URL.",
            status: "invalid",
          });
          return;
        }

        setUrlValidation({
          checkedUrl: nextUrl,
          message: "URL is good",
          status: "valid",
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        if (urlValidationAbortControllerRef.current !== abortController) {
          return;
        }

        setUrlValidation({
          checkedUrl: nextUrl,
          message:
            error instanceof Error
              ? error.message
              : "Could not fetch the PDF URL.",
          status: "invalid",
        });
      } finally {
        if (urlValidationAbortControllerRef.current === abortController) {
          urlValidationAbortControllerRef.current = null;
        }
      }
    },
    [cancelUrlValidation],
  );

  useEffect(() => {
    if (
      sourceMode !== "url" ||
      trimmedPdfUrl.length === 0 ||
      !isAbsoluteHttpUrl(trimmedPdfUrl)
    ) {
      cancelUrlValidation();
      return;
    }

    urlValidationTimerRef.current = setTimeout(() => {
      urlValidationTimerRef.current = null;
      void validatePdfUrl(trimmedPdfUrl);
    }, URL_VALIDATION_DEBOUNCE_MS);

    return () => {
      cancelUrlValidation();
    };
  }, [cancelUrlValidation, sourceMode, trimmedPdfUrl, validatePdfUrl]);

  useEffect(() => {
    setIsBlocked(isSubmitting);
  }, [isSubmitting, setIsBlocked]);

  useEffect(() => {
    return () => {
      setIsBlocked(false);
    };
  }, [setIsBlocked]);

  useEffect(() => {
    if (!submissionResultId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      liveOutputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [submissionResultId]);

  function handleSourceModeChange(nextMode: SourceMode) {
    cancelUrlValidation();
    setSourceMode(nextMode);
    setSubmissionError(null);
    setSubmissionResult(null);
    setUrlValidation(createIdleUrlValidationState());

    if (nextMode === "url") {
      setSelectedFile(null);
    } else {
      setPdfUrl("");
    }
  }

  function handlePdfUrlBlur() {
    if (sourceMode !== "url" || trimmedPdfUrl.length === 0) {
      return;
    }

    if (!isAbsoluteHttpUrl(trimmedPdfUrl)) {
      setUrlValidation({
        checkedUrl: trimmedPdfUrl,
        message: INVALID_PDF_URL_MESSAGE,
        status: "invalid",
      });
      return;
    }

    if (urlValidation.checkedUrl === trimmedPdfUrl) {
      return;
    }

    void validatePdfUrl(trimmedPdfUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity() || !selectedCategory) {
      return;
    }

    if (sourceMode === "url" && !hasValidatedPdfUrl) {
      if (trimmedPdfUrl.length === 0) {
        return;
      }

      if (!isAbsoluteHttpUrl(trimmedPdfUrl)) {
        setUrlValidation({
          checkedUrl: trimmedPdfUrl,
          message: INVALID_PDF_URL_MESSAGE,
          status: "invalid",
        });
        return;
      }

      if (urlValidation.checkedUrl !== trimmedPdfUrl) {
        void validatePdfUrl(trimmedPdfUrl);
      }

      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmissionResult(null);

    try {
      const formData = new FormData();

      formData.set("sourceMode", sourceMode);
      formData.set("partNumber", partNumber.trim());
      formData.set("packageCategory", selectedCategory);

      if (sourceMode === "upload") {
        if (!selectedFile) {
          throw new Error("Please choose a PDF file to upload.");
        }

        formData.set("datasheetFile", selectedFile);
      } else {
        formData.set("datasheetUrl", pdfUrl.trim());
      }

      const response = await fetch("/api/extractions", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | SubmissionDetail
        | { error?: string }
        | null;

      if (!response.ok) {
        const errorMessage =
          payload && "error" in payload
            ? payload.error || "Extraction request failed."
            : "Extraction request failed.";

        throw new Error(errorMessage);
      }

      setSubmissionResult(payload as SubmissionDetail);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Unexpected extraction request failure.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
              Intake Workbench
            </p>
            <h2 className="text-3xl">Prepare a datasheet extraction request</h2>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <p className="text-sm font-medium text-text">PDF source</p>
              <div className="flex w-full flex-col gap-2 rounded-panel border border-border bg-surface-muted p-1.5 sm:flex-row sm:gap-1.5">
                {sourceModes.map((option) => {
                  const isActive = option.value === sourceMode;

                  return (
                    <button
                      key={option.value}
                      aria-pressed={isActive}
                      className={[
                        "flex-1 rounded-pill px-5 py-3 text-center text-sm font-medium transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-60",
                        isActive
                          ? "bg-surface text-text shadow-soft"
                          : "text-text-muted hover:text-text",
                      ].join(" ")}
                      disabled={isSubmitting}
                      onClick={() => handleSourceModeChange(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {sourceMode === "upload" ? (
              <Field htmlFor="datasheet-file" label="Upload datasheet PDF" required>
                <FileField
                  accept=".pdf,application/pdf"
                  disabled={isSubmitting}
                  id="datasheet-file"
                  name="datasheetFile"
                  onChange={(event) => {
                    setSubmissionError(null);
                    setSelectedFile(event.currentTarget.files?.[0] ?? null);
                    setSubmissionResult(null);
                  }}
                  required
                />
              </Field>
            ) : (
              <Field
                hint={urlValidationHint}
                htmlFor="datasheet-url"
                label="Datasheet PDF URL"
                required
              >
                <TextField
                  disabled={isSubmitting}
                  endAdornment={urlValidationAdornment}
                  id="datasheet-url"
                  invalid={urlValidation.status === "invalid"}
                  inputMode="url"
                  name="datasheetUrl"
                  onBlur={handlePdfUrlBlur}
                  onChange={(event) => {
                    setSubmissionError(null);
                    setSubmissionResult(null);

                    const nextValue = event.currentTarget.value;
                    const nextTrimmedPdfUrl = nextValue.trim();

                    if (nextTrimmedPdfUrl !== trimmedPdfUrl) {
                      cancelUrlValidation();
                    }

                    setPdfUrl(nextValue);
                    setUrlValidation((current) => {
                      if (nextTrimmedPdfUrl.length === 0) {
                        return createIdleUrlValidationState();
                      }

                      if (!isAbsoluteHttpUrl(nextTrimmedPdfUrl)) {
                        return {
                          checkedUrl: nextTrimmedPdfUrl,
                          message: INVALID_PDF_URL_MESSAGE,
                          status: "invalid",
                        };
                      }

                      if (current.checkedUrl === nextTrimmedPdfUrl) {
                        return current;
                      }

                      return createIdleUrlValidationState();
                    });
                  }}
                  placeholder="https://vendor.example.com/datasheet.pdf"
                  required
                  type="url"
                  value={pdfUrl}
                />
              </Field>
            )}

            {sourceMode === "upload" && selectedFile ? (
              <div className="rounded-control border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
                Selected file:{" "}
                <span className="font-medium text-text">{selectedFile.name}</span>
                <span className="mx-2 text-border-strong">·</span>
                {formatFileSize(selectedFile.size)}
              </div>
            ) : null}

            <Field htmlFor="part-number" label="Part number" required>
              <TextField
                disabled={isSubmitting}
                id="part-number"
                name="partNumber"
                onChange={(event) => {
                  setSubmissionError(null);
                  setPartNumber(event.currentTarget.value);
                  setSubmissionResult(null);
                }}
                placeholder="STM32F103C8T6"
                required
                value={partNumber}
              />
            </Field>

            <Field htmlFor="package-category" label="Package category" required>
              <SelectField
                disabled={isSubmitting}
                id="package-category"
                name="packageCategory"
                onChange={(event) => {
                  setSubmissionError(null);
                  setSelectedCategory(
                    event.currentTarget.value as PackageCategory | "",
                  );
                  setSubmissionResult(null);
                }}
                required
                value={selectedCategory}
              >
                <option value="">Choose a package category</option>
                {packageCategories.map((packageCategory) => (
                  <option key={packageCategory} value={packageCategory}>
                    {packageCategory}
                  </option>
                ))}
              </SelectField>
            </Field>

            <div className="border-t border-border pt-6">
              <Button className="w-full" disabled={!canSubmit} size="lg" type="submit">
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    />
                    Submitting to AI for extraction...
                  </span>
                ) : (
                  "Submit for extraction"
                )}
              </Button>
            </div>

            <p aria-live="polite" className="sr-only">
              {liveRegionMessage}
            </p>

            {submissionError ? (
              <div className="rounded-control border border-border-strong bg-surface-muted px-4 py-3 text-sm leading-6 text-text">
                {submissionError}
              </div>
            ) : null}
          </form>
        </Card>

        <div>
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Fields To Extract
                </p>
                <h3 className="text-2xl">
                  {selectedCategory || "Choose a package category"}
                </h3>
              </div>
              <div className="rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-muted">
                {previewFields.length} fields
              </div>
            </div>

            {previewFields.length > 0 ? (
              <div className="grid gap-3">
                {previewFields.map((field, index) => (
                  <div
                    key={field}
                    className="flex items-center justify-between rounded-control border border-border bg-surface-muted px-4 py-3"
                  >
                    <span className="text-sm font-medium text-text">{field}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                      Field {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-control border border-dashed border-border-strong bg-surface-muted px-4 py-5 text-sm leading-6 text-text-muted">
                Select a package category to list the exact dimensions and
                metadata this workflow will request from the AI step.
              </div>
            )}
          </Card>
        </div>
      </div>

      {submissionResult ? (
        <div ref={liveOutputRef}>
          <SubmissionReviewEditor
            initialSubmission={submissionResult}
            mode="live"
          />
        </div>
      ) : null}
    </div>
  );
}
