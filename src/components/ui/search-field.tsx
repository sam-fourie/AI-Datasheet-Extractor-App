"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Search, X } from "lucide-react";

import { cn } from "./cn";
import {
  controlClassName,
  inputControlClassName,
  type ControlSize,
} from "./control-styles";
import { Kbd } from "./kbd";

export type SearchFieldProps = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  className?: string;
  controlSize?: ControlSize;
  /** Delay before `onChange` fires while typing. Clearing is immediate. */
  debounceMs?: number;
  id?: string;
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** A single key (e.g. "/") that focuses the field from anywhere on the page. */
  shortcutKey?: string;
  value: string;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function SearchField({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel = "Search",
  className,
  controlSize = "md",
  debounceMs = 0,
  id,
  name,
  onChange,
  placeholder = "Search",
  shortcutKey,
  value,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  // Adopt outside changes (e.g. the URL changed) during render.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shortcutKey) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.key !== shortcutKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        isTypingTarget(event.target) ||
        document.querySelector("dialog[open]")
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcutKey]);

  function commit(nextValue: string, immediate: boolean) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (immediate || debounceMs <= 0) {
      onChangeRef.current(nextValue);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current(nextValue);
    }, debounceMs);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
    commit(event.target.value, false);
  }

  function clear() {
    setDraft("");
    commit("", true);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && draft) {
      event.preventDefault();
      event.stopPropagation();
      clear();
    } else if (event.key === "Enter") {
      commit(draft, true);
    }
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted"
      />
      <input
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        autoComplete="off"
        className={controlClassName(
          cn(
            inputControlClassName(controlSize),
            "pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          ),
        )}
        enterKeyHint="search"
        id={id}
        name={name}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        spellCheck={false}
        type="search"
        value={draft}
      />
      {draft ? (
        <button
          aria-label="Clear search"
          className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-text pointer-coarse:size-11"
          onClick={clear}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : shortcutKey ? (
        <Kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 pointer-coarse:hidden"
        >
          {shortcutKey}
        </Kbd>
      ) : null}
    </div>
  );
}
