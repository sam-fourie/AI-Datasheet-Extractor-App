"use client";

import { useId, useState } from "react";

import { Button, Field, FileField, SegmentedControl, TextField } from "@/components/ui";
import { validateDrawingInput, type DrawingInput } from "@/lib/drawing-upload";

type DrawingMode = "upload" | "url";

const MODE_OPTIONS = [
  { label: "Upload", value: "upload" },
  { label: "Link", value: "url" },
] satisfies Array<{ label: string; value: DrawingMode }>;

export type DrawingFieldProps = {
  disabled?: boolean;
  /** Shown under the field, e.g. what the AI said the datasheet refers to. */
  hint?: string;
  label?: string;
  /** Called with the drawing as picked, or null when the field is cleared or not valid yet. */
  onChange: (drawing: DrawingInput | null) => void;
};

/**
 * The optional package drawing: a second PDF with the package outline, for
 * datasheets that keep their dimensions in a separate document. Used by the
 * new-extraction form and the re-run dialog.
 */
export function DrawingField({ disabled = false, hint, label = "Package drawing", onChange }: DrawingFieldProps) {
  const id = useId();
  const [mode, setMode] = useState<DrawingMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const input: DrawingInput | null =
    mode === "upload" ? (file ? { file, kind: "upload" } : null) : url.trim() ? { kind: "url", url } : null;
  const error = input ? validateDrawingInput(input) : null;

  function publish(next: DrawingInput | null) {
    onChange(next && validateDrawingInput(next) === null ? next : null);
  }

  function changeMode(next: DrawingMode) {
    setMode(next);
    publish(next === "upload" ? (file ? { file, kind: "upload" } : null) : url.trim() ? { kind: "url", url } : null);
  }

  return (
    <Field
      error={error}
      hint={hint ?? "Optional. Add it when the datasheet points to a separate package outline."}
      htmlFor={`${id}-${mode}`}
      label={label}
    >
      <div className="flex flex-col gap-2">
        <SegmentedControl
          aria-label={`${label} source`}
          onChange={changeMode}
          options={MODE_OPTIONS}
          size="sm"
          value={mode}
        />
        {mode === "upload" ? (
          <div className="flex items-center gap-2">
            <FileField
              accept="application/pdf,.pdf"
              className="min-w-0 flex-1"
              disabled={disabled}
              id={`${id}-upload`}
              invalid={Boolean(error)}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;

                setFile(next);
                publish(next ? { file: next, kind: "upload" } : null);
              }}
            />
            {file ? (
              <Button
                disabled={disabled}
                onClick={() => {
                  setFile(null);
                  publish(null);

                  const element = document.getElementById(`${id}-upload`) as HTMLInputElement | null;

                  if (element) {
                    element.value = "";
                  }
                }}
                size="sm"
                variant="ghost"
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : (
          <TextField
            disabled={disabled}
            id={`${id}-url`}
            inputMode="url"
            invalid={Boolean(error)}
            onChange={(event) => {
              setUrl(event.target.value);
              publish(event.target.value.trim() ? { kind: "url", url: event.target.value } : null);
            }}
            placeholder="https://… outline PDF"
            value={url}
          />
        )}
      </div>
    </Field>
  );
}
