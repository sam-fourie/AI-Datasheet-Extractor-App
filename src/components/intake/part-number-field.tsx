"use client";

import type { ReactNode, RefObject } from "react";

import { Button, Field, TextField } from "@/components/ui";

export type PartNumberFieldProps = {
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  /** Rendered under the field, e.g. the duplicate notice. */
  notice?: ReactNode;
  /** Suggestion from the datasheet's file name; shown only while the field is empty. */
  suggestion: string | null;
  value: string;
};

export const PART_NUMBER_INPUT_ID = "part-number";

/**
 * Part number in mono. The value is never case-changed ("IRF540NPbF" stays as
 * typed); it is trimmed on blur only.
 */
export function PartNumberField({
  error,
  inputRef,
  notice,
  onChange,
  suggestion,
  value,
}: PartNumberFieldProps) {
  const showSuggestion = suggestion !== null && value.trim().length === 0;

  return (
    <div className="min-w-0 space-y-2">
      <Field error={error} htmlFor={PART_NUMBER_INPUT_ID} label="Part number" required>
        <TextField
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="font-mono"
          controlSize="lg"
          id={PART_NUMBER_INPUT_ID}
          name="partNumber"
          onBlur={(event) => {
            const trimmed = event.currentTarget.value.trim();

            if (trimmed !== event.currentTarget.value) {
              onChange(trimmed);
            }
          }}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="e.g. STM32F103C8T6"
          ref={inputRef}
          spellCheck={false}
          value={value}
        />
      </Field>
      {showSuggestion ? (
        <Button
          className="h-7 max-w-full rounded-xs bg-surface-muted px-2 text-callout text-text hover:bg-surface-sunken"
          onClick={() => {
            onChange(suggestion);
            inputRef.current?.focus();
          }}
          size="sm"
          variant="ghost"
        >
          Use <span className="min-w-0 truncate font-mono">{suggestion}</span>
        </Button>
      ) : null}
      {notice}
    </div>
  );
}
