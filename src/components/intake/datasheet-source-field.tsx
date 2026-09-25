"use client";

import { useRef, useState, type DragEvent, type RefObject } from "react";
import { CircleAlert, CircleCheck, FileText, FileUp, Link2, X } from "lucide-react";

import { Button, cn, IconButton, Spinner, TextField } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { MAX_PDF_BYTES } from "@/lib/pdf";

import type { SourceKind } from "./intake-helpers";
import type { UrlValidation } from "./use-url-validation";

export type DatasheetSourceFieldProps = {
  /** The source that will be extracted (most recently edited, with a value). */
  activeSource: SourceKind | null;
  browseButtonRef: RefObject<HTMLButtonElement | null>;
  file: File | null;
  /** Type or size problem with the chosen file. */
  fileError: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** Shown when the form was submitted with no datasheet at all. */
  missingError: string | null;
  onActivate: (source: SourceKind) => void;
  onFileChange: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  /** Submit-time problem with the link (malformed, or failed validation). */
  showUrlErrors: boolean;
  url: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
  urlValidation: UrlValidation;
};

const FILE_INPUT_ID = "datasheet-file";
const URL_INPUT_ID = "datasheet-url";
const SOURCE_ERROR_ID = "datasheet-source-error";
const FILE_ERROR_ID = "datasheet-file-error";
const URL_ERROR_ID = "datasheet-url-error";
const URL_CHIP_ID = "datasheet-url-source";
const DROP_CAPTION_ID = "datasheet-drop-caption";

export function describeUrlValidationError(validation: UrlValidation) {
  if (validation.status === "malformed") {
    return "Enter a full link that starts with https://";
  }

  if (validation.status !== "invalid") {
    return null;
  }

  switch (validation.code) {
    case "source-unreachable":
      return "We couldn't download that PDF. The site blocked the download or the link has moved.";
    case "invalid-pdf":
      return "That link doesn't return a readable PDF.";
    case "too-large":
      return `That PDF is over ${formatBytes(MAX_PDF_BYTES)}. Download it, compress it and upload the smaller copy.`;
    case "invalid-request":
      return "Enter a full link that starts with https://";
    default:
      return validation.message;
  }
}

function ErrorLine({ children, id }: { children: string; id: string }) {
  return (
    <p className="flex items-start gap-1 text-caption text-danger" id={id}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Datasheet source: a drop zone (or the chosen file's row) and a link input,
 * both kept in state. The most recently edited one is the active source; the
 * other dims and offers "Use this instead" (spec §4.1).
 */
export function DatasheetSourceField({
  activeSource,
  browseButtonRef,
  file,
  fileError,
  fileInputRef,
  missingError,
  onActivate,
  onFileChange,
  onUrlChange,
  showUrlErrors,
  url,
  urlInputRef,
  urlValidation,
}: DatasheetSourceFieldProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasUrl = url.trim().length > 0;
  const fileDimmed = file !== null && activeSource === "url";
  const urlDimmed = hasUrl && activeSource === "upload";
  const urlError =
    activeSource === "url" &&
    (showUrlErrors || urlValidation.status === "invalid")
      ? describeUrlValidationError(urlValidation)
      : null;
  const showUploadInstead =
    urlError !== null && urlValidation.status === "invalid";

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function takeFile(nextFile: File | null | undefined) {
    if (nextFile) {
      onFileChange(nextFile);
    }
  }

  function handleDragEnter(event: DragEvent) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    takeFile(event.dataTransfer.files?.[0]);
  }

  const urlAdornment =
    urlValidation.status === "checking" ? (
      <Spinner className="text-text-muted" />
    ) : urlValidation.status === "valid" ? (
      <CircleCheck aria-hidden="true" className="size-4 text-success" />
    ) : urlError ? (
      <CircleAlert aria-hidden="true" className="size-4 text-danger" />
    ) : undefined;

  const urlDescribedBy =
    [
      urlValidation.status === "valid" ? URL_CHIP_ID : null,
      urlError ? URL_ERROR_ID : null,
      missingError ? SOURCE_ERROR_ID : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <fieldset
      className="min-w-0 space-y-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDrop}
    >
      <legend className="mb-1.5 text-callout font-medium text-text">
        Datasheet
        <span aria-hidden="true" className="ml-1 text-text-muted">
          *
        </span>
      </legend>

      <input
        accept="application/pdf,.pdf"
        aria-hidden="true"
        className="sr-only"
        id={FILE_INPUT_ID}
        onChange={(event) => {
          takeFile(event.currentTarget.files?.[0]);
          // Allow choosing the same file again after removing it.
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      {file ? (
        <div className="space-y-1.5">
          <div
            className={cn(
              "flex min-h-12 min-w-0 items-center gap-3 rounded-md bg-surface-muted py-1.5 pr-1.5 pl-3 transition-colors duration-(--ui-duration-fast) ease-ui",
              isDragging && "bg-accent-soft outline-2 outline-dashed outline-accent",
              fileError && "outline-1 outline-danger",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3",
                fileDimmed && "opacity-60",
              )}
            >
              <FileText aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
              <p className="min-w-0 flex-1 text-body">
                <span className="block truncate font-medium text-text" title={file.name}>
                  {file.name}
                </span>
                <span className="block text-caption text-text-muted tabular-nums">
                  {formatBytes(file.size)}
                  {fileDimmed ? " · not used" : null}
                </span>
              </p>
            </div>
            {fileDimmed ? (
              <Button onClick={() => onActivate("upload")} size="sm" variant="plain">
                Use this instead
              </Button>
            ) : null}
            <Button
              aria-describedby={fileError ? FILE_ERROR_ID : undefined}
              aria-invalid={fileError ? true : undefined}
              onClick={openFilePicker}
              ref={browseButtonRef}
              size="sm"
              variant="plain"
              className="px-1"
            >
              Replace<span className="sr-only"> {file.name}</span>
            </Button>
            <IconButton
              icon={<X />}
              label="Remove file"
              onClick={() => {
                onFileChange(null);
                window.requestAnimationFrame(() => browseButtonRef.current?.focus());
              }}
              size="sm"
            />
          </div>
          {fileError ? <ErrorLine id={FILE_ERROR_ID}>{fileError}</ErrorLine> : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex h-[132px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong px-4 text-center transition-colors duration-(--ui-duration-fast) ease-ui sm:h-40",
            isDragging && "border-accent bg-accent-soft",
            missingError && !isDragging && "border-danger",
          )}
          onClick={(event) => {
            // Pointer convenience: the whole zone opens the picker. Keyboard uses "browse".
            if (event.target === event.currentTarget) {
              openFilePicker();
            }
          }}
        >
          <FileUp aria-hidden="true" className="mb-1 size-6 text-text-muted" />
          <p className="text-body font-medium text-text">Drop a datasheet PDF</p>
          <p className="text-callout text-text-muted">
            or{" "}
            <Button
              aria-describedby={
                [DROP_CAPTION_ID, missingError ? SOURCE_ERROR_ID : null]
                  .filter(Boolean)
                  .join(" ")
              }
              aria-invalid={missingError ? true : undefined}
              aria-label="Browse for a datasheet PDF"
              className="text-callout font-medium"
              onClick={openFilePicker}
              ref={browseButtonRef}
              size="sm"
              variant="plain"
            >
              browse
            </Button>
          </p>
          <p className="text-caption text-text-muted" id={DROP_CAPTION_ID}>
            PDF up to {formatBytes(MAX_PDF_BYTES)}
          </p>
        </div>
      )}

      <div aria-hidden="true" className="flex items-center gap-3 text-caption text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or paste a link
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-1.5">
        <label className="sr-only" htmlFor={URL_INPUT_ID}>
          Datasheet link
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              aria-describedby={urlDescribedBy}
              autoComplete="off"
              className={cn("min-w-0", urlDimmed && "text-text-muted")}
              controlSize="lg"
              endAdornment={urlAdornment}
              id={URL_INPUT_ID}
              inputMode="url"
              invalid={urlError !== null}
              onChange={(event) => onUrlChange(event.currentTarget.value)}
              placeholder="https://…/datasheet.pdf"
              ref={urlInputRef}
              spellCheck={false}
              startAdornment={<Link2 />}
              type="url"
              value={url}
            />
          </div>
          {urlDimmed ? (
            <Button
              className="shrink-0"
              onClick={() => onActivate("url")}
              size="sm"
              variant="plain"
            >
              Use this instead
            </Button>
          ) : null}
        </div>
        {urlValidation.status === "valid" ? (
          <p
            className={cn(
              "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-xs bg-surface-muted px-2 py-0.5 text-caption text-text-muted",
              urlDimmed && "opacity-60",
            )}
            id={URL_CHIP_ID}
          >
            <CircleCheck aria-hidden="true" className="size-3 shrink-0 text-success" />
            <span className="min-w-0 truncate">
              {[urlValidation.host, urlValidation.fileName, formatBytes(urlValidation.sizeBytes)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
        ) : null}
        {urlError ? (
          <div className="space-y-1">
            <ErrorLine id={URL_ERROR_ID}>{urlError}</ErrorLine>
            {showUploadInstead ? (
              <Button
                className="ml-4"
                onClick={() => {
                  onActivate("upload");

                  if (file) {
                    browseButtonRef.current?.focus();
                  } else {
                    openFilePicker();
                  }
                }}
                size="sm"
                variant="plain"
              >
                Upload a file instead
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {missingError ? <ErrorLine id={SOURCE_ERROR_ID}>{missingError}</ErrorLine> : null}
    </fieldset>
  );
}
