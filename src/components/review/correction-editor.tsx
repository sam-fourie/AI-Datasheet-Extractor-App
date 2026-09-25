"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { Button, Field, Kbd, TextField, cn } from "@/components/ui";
import { NOT_FOUND_VALUE } from "@/lib/submissions/extraction-snapshot";
import {
  getCorrectionDefaults,
  getRowDecision,
  isCorrectionUnchanged,
  validateCorrection,
  type CorrectionInput,
  type MeasurementCorrectionInput,
  type PackageCorrectionInput,
  type PinCorrectionInput,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import type { ExtractionSnapshot, SubmissionHumanReview } from "@/lib/submissions/types";

import {
  correctionEditorDomId,
  correctionInputDomId,
  type ReviewRowCallbacks,
} from "./types";

export type CorrectionEditorProps = {
  callbacks: Pick<
    ReviewRowCallbacks,
    | "onApplyCorrection"
    | "onCloseCorrection"
    | "onCorrectionDraftChange"
    | "onDecide"
    | "onRemoveCorrection"
  >;
  className?: string;
  extraction: ExtractionSnapshot;
  /** The DRAFT review; prefill comes from getCorrectionDefaults (existing correction, else AI value). */
  review: SubmissionHumanReview;
  rowRef: ReviewRowRef;
  /** Row name for the region label, e.g. "Body Length" or "pin 8, VCC". */
  subject: string;
};

function sameInput(left: CorrectionInput, right: CorrectionInput) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Inline correction editor under a row (§5.3, addendum K). The draft does not
 * change until Apply. Enter applies, ⌘Enter / Ctrl+Enter applies and moves to
 * the next pending row, Esc closes without changing the decision.
 *
 * Mount it only while the row's editor is open and key it by the row key, so
 * each opening starts from fresh defaults.
 */
export function CorrectionEditor({
  callbacks,
  className,
  extraction,
  review,
  rowRef,
  subject,
}: CorrectionEditorProps) {
  const [initial] = useState<CorrectionInput>(() => getCorrectionDefaults(extraction, review, rowRef));
  const [input, setInput] = useState<CorrectionInput>(initial);
  const [touched, setTouched] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const draftChangeRef = useRef(callbacks.onCorrectionDraftChange);
  const rowRefRef = useRef(rowRef);

  const error = validateCorrection(rowRef, input);
  const unchanged = error === null && isCorrectionUnchanged(extraction, rowRef, input);
  const isCorrected = getRowDecision(review, rowRef) === "corrected";
  const dirty = !sameInput(initial, input);
  const inputId = correctionInputDomId(rowRef);
  const editorId = correctionEditorDomId(rowRef);

  useEffect(() => {
    draftChangeRef.current = callbacks.onCorrectionDraftChange;
    rowRefRef.current = rowRef;
  });

  // Autofocus the first field with its prefill fully selected.
  useEffect(() => {
    const element = firstInputRef.current;

    if (element) {
      element.focus({ preventScroll: true });
      element.select();
      element.scrollIntoView({ block: "nearest" });
    }
  }, []);

  useEffect(() => {
    draftChangeRef.current?.(rowRefRef.current, dirty);
  }, [dirty]);

  useEffect(() => {
    return () => draftChangeRef.current?.(rowRefRef.current, false);
  }, []);

  function update(next: CorrectionInput) {
    setInput(next);
    setTouched(true);
  }

  function apply(advance: boolean) {
    setTouched(true);

    if (validateCorrection(rowRef, input) !== null) {
      firstInputRef.current?.focus();
      return;
    }

    callbacks.onApplyCorrection(rowRef, input, { advance });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onCloseCorrection(rowRef);
      return;
    }

    if (event.key === "Enter" && target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      apply(event.metaKey || event.ctrlKey);
    }
  }

  const showError = touched && error !== null;

  return (
    <div
      aria-label={`Correct ${subject}`}
      className={cn(
        "animate-float-in cursor-default bg-surface-muted px-4 py-3 md:pl-11",
        className,
      )}
      id={editorId}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      role="group"
    >
      <div className="space-y-3">
        {input.kind === "measurement" ? (
          <MeasurementFields
            error={showError ? error : null}
            input={input}
            inputId={inputId}
            inputRef={firstInputRef}
            onChange={update}
          />
        ) : input.kind === "pin" ? (
          <PinFields
            error={showError ? error : null}
            input={input}
            inputId={inputId}
            inputRef={firstInputRef}
            onChange={update}
          />
        ) : (
          <PackageFields
            alternatives={[
              extraction.packageSelection.selectedPackage,
              ...extraction.packageSelection.alternatives,
            ]}
            error={showError ? error : null}
            input={input}
            inputId={inputId}
            inputRef={firstInputRef}
            onChange={update}
          />
        )}

        <Field htmlFor={`${inputId}-note`} label="Note (optional)">
          <TextField
            autoComplete="off"
            id={`${inputId}-note`}
            onChange={(event) => update({ ...input, note: event.target.value })}
            placeholder="Why it's wrong, or where you found the value"
            value={input.note}
          />
        </Field>

        <div aria-live="polite" className="min-h-0 empty:hidden">
          {unchanged ? (
            <p className="flex flex-wrap items-center gap-x-2 text-callout text-text-muted">
              <span>Same as the AI value.</span>
              <Button
                onClick={() => callbacks.onDecide(rowRef, "confirmed")}
                size="sm"
                variant="plain"
              >
                Confirm instead
              </Button>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-caption text-text-muted">
              Not sure? Leave it pending (U) and explain in Reviewer notes.
            </p>
            {isCorrected ? (
              <Button
                className="self-start"
                onClick={() => callbacks.onRemoveCorrection(rowRef)}
                size="sm"
                variant="plain"
              >
                Remove correction
              </Button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button onClick={() => callbacks.onCloseCorrection(rowRef)} size="sm" variant="ghost">
              Cancel
              <Kbd aria-hidden="true" className="pointer-coarse:hidden">
                Esc
              </Kbd>
            </Button>
            <Button
              aria-keyshortcuts="Enter Meta+Enter Control+Enter"
              disabled={error !== null}
              onClick={(event) => apply(event.metaKey || event.ctrlKey)}
              size="sm"
              title="Enter applies · ⌘Enter applies and moves to the next pending row"
              variant="primary"
            >
              Apply
              <span aria-hidden="true" className="text-caption opacity-80 pointer-coarse:hidden">
                ↵
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type FieldsProps<T extends CorrectionInput> = {
  error: string | null;
  input: T;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (next: CorrectionInput) => void;
};

function MeasurementFields({ error, input, inputId, inputRef, onChange }: FieldsProps<MeasurementCorrectionInput>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Field className="min-w-0 flex-1" error={error} htmlFor={inputId} label="Correct value">
        <TextField
          autoComplete="off"
          className={cn("tabular-nums", input.notInDatasheet && "italic text-text-muted")}
          id={inputId}
          invalid={error !== null}
          onChange={(event) => {
            const value = event.target.value;

            onChange({ ...input, notInDatasheet: value.trim() === NOT_FOUND_VALUE, value });
          }}
          ref={inputRef}
          spellCheck={false}
          value={input.value}
        />
      </Field>
      <Button
        aria-pressed={input.notInDatasheet}
        className="self-start sm:mt-6 sm:h-8"
        onClick={() =>
          onChange(
            input.notInDatasheet
              ? { ...input, notInDatasheet: false, value: "" }
              : { ...input, notInDatasheet: true, value: NOT_FOUND_VALUE },
          )
        }
        size="sm"
        variant="plain"
      >
        {input.notInDatasheet ? "Enter a value instead" : "Not in datasheet"}
      </Button>
    </div>
  );
}

function PinFields({ error, input, inputId, inputRef, onChange }: FieldsProps<PinCorrectionInput>) {
  const describedBy = error ? `${inputId}-pin-error` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Field className="w-24 shrink-0" htmlFor={inputId} label="Pin number">
          <TextField
            aria-describedby={describedBy}
            autoComplete="off"
            className="font-mono"
            id={inputId}
            invalid={error !== null && input.pinNumber.trim().length === 0}
            onChange={(event) => onChange({ ...input, pinNumber: event.target.value })}
            ref={inputRef}
            spellCheck={false}
            value={input.pinNumber}
          />
        </Field>
        <Field className="min-w-0 flex-1" htmlFor={`${inputId}-name`} label="Pin name">
          <TextField
            aria-describedby={describedBy}
            autoComplete="off"
            className="font-mono"
            id={`${inputId}-name`}
            invalid={error !== null && input.pinName.trim().length === 0}
            onChange={(event) => onChange({ ...input, pinName: event.target.value })}
            spellCheck={false}
            value={input.pinName}
          />
        </Field>
      </div>
      {error ? (
        <p className="text-caption text-danger" id={`${inputId}-pin-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PackageFields({
  alternatives,
  error,
  input,
  inputId,
  inputRef,
  onChange,
}: FieldsProps<PackageCorrectionInput> & { alternatives: string[] }) {
  const options = Array.from(new Set(alternatives.map((option) => option.trim()).filter(Boolean)));

  return (
    <div className="space-y-2">
      <Field error={error} htmlFor={inputId} label="Correct package">
        <TextField
          autoComplete="off"
          id={inputId}
          invalid={error !== null}
          onChange={(event) => onChange({ ...input, selectedPackage: event.target.value })}
          ref={inputRef}
          spellCheck={false}
          value={input.selectedPackage}
        />
      </Field>
      {options.length > 1 ? (
        <div aria-label="Packages the AI considered" className="flex flex-wrap gap-1.5" role="group">
          {options.map((option) => {
            const selected = option === input.selectedPackage.trim();

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "inline-flex h-7 items-center rounded-xs border px-2 text-callout transition-colors duration-(--ui-duration-fast) ease-ui pointer-coarse:h-11",
                  selected
                    ? "border-accent bg-accent-soft text-accent-text"
                    : "border-border-strong bg-surface text-text hover:bg-surface-hover",
                )}
                key={option}
                onClick={() => onChange({ ...input, selectedPackage: option })}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
