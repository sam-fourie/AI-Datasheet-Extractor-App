"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "./cn";
import {
  controlClassName,
  inputControlClassName,
  type ControlSize,
} from "./control-styles";
import { floatingBaseClassName, positionFloating } from "./floating";

export type ComboboxOption = {
  keywords?: string[];
  label: string;
  meta?: string;
  value: string;
};

export type ComboboxGroup = {
  label: string;
  options: ComboboxOption[];
};

export type ComboboxProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  controlSize?: ControlSize;
  disabled?: boolean;
  emptyText?: string;
  groups: ComboboxGroup[];
  /** Id of the text input, so a `<label htmlFor>` or `Field` can target it. */
  id?: string;
  /** Receives the text input element (object or callback ref). */
  inputRef?: Ref<HTMLInputElement>;
  invalid?: boolean;
  /** Submits the selected value with a surrounding form. */
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string | null;
};

type FlatOption = ComboboxOption & { groupIndex: number; optionId: string };

/** Assigns an object or callback ref and returns its detach function. */
function attachRef<T>(ref: Ref<T> | undefined, value: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(value);

    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }

  if (ref) {
    ref.current = value;

    return () => {
      ref.current = null;
    };
  }

  return () => {};
}

export function normalizeComboboxText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesQuery(option: ComboboxOption, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return [option.label, ...(option.keywords ?? [])].some((text) =>
    normalizeComboboxText(text).includes(normalizedQuery),
  );
}

/**
 * Editable combobox with a grouped listbox (ARIA 1.2 pattern). Typing
 * filters on label and keywords (case and punctuation ignored); arrow keys
 * move the active option, Enter selects, Escape closes, then clears.
 */
export function Combobox({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  controlSize = "md",
  disabled = false,
  emptyText = "No matches",
  groups,
  id,
  inputRef: externalInputRef,
  invalid = false,
  name,
  onChange,
  placeholder,
  required,
  value,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const statusId = `${generatedId}-status`;
  const inputRef = useRef<HTMLInputElement>(null);
  const setInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      const detach = attachRef(externalInputRef, element);

      return () => {
        inputRef.current = null;
        detach();
      };
    },
    [externalInputRef],
  );
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = useMemo(() => {
    for (const group of groups) {
      const match = group.options.find((option) => option.value === value);

      if (match) {
        return match;
      }
    }

    return null;
  }, [groups, value]);

  const { filteredGroups, flatOptions } = useMemo(() => {
    const normalizedQuery = normalizeComboboxText(query ?? "");
    const flat: FlatOption[] = [];
    const visibleGroups = groups
      .map((group, groupIndex) => ({
        groupIndex,
        label: group.label,
        options: group.options
          .filter((option) => matchesQuery(option, normalizedQuery))
          .map((option) => {
            const flatOption = {
              ...option,
              groupIndex,
              optionId: `${generatedId}-option-${groupIndex}-${normalizeComboboxText(option.value) || "blank"}-${flat.length}`,
            };
            flat.push(flatOption);
            return flatOption;
          }),
      }))
      .filter((group) => group.options.length > 0);

    return { filteredGroups: visibleGroups, flatOptions: flat };
  }, [generatedId, groups, query]);

  const activeOption = open ? flatOptions[activeIndex] : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    const input = inputRef.current;
    const listbox = listboxRef.current;

    if (!input || !listbox) {
      return;
    }

    function reposition() {
      if (!input || !listbox) {
        return;
      }

      listbox.style.width = `${input.getBoundingClientRect().width}px`;
      positionFloating(input, listbox, { align: "start", side: "bottom" });
    }

    try {
      listbox.showPopover();
    } catch {
      // Already shown.
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);

      try {
        listbox.hidePopover();
      } catch {
        // Already hidden.
      }
    };
  }, [open]);

  useEffect(() => {
    if (!activeOption) {
      return;
    }

    document
      .getElementById(activeOption.optionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  function openList(nextActiveIndex?: number) {
    if (disabled) {
      return;
    }

    setOpen(true);

    if (nextActiveIndex !== undefined) {
      setActiveIndex(nextActiveIndex);
    } else {
      const selectedIndex = flatOptions.findIndex(
        (option) => option.value === value,
      );
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }

  function closeList() {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  }

  function selectOption(option: FlatOption) {
    onChange(option.value);
    closeList();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setOpen(true);
    setActiveIndex(0);
  }

  function moveActive(delta: number) {
    if (flatOptions.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const next = current + delta;

      if (next < 0) {
        return flatOptions.length - 1;
      }

      return next >= flatOptions.length ? 0 : next;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();

        if (!open) {
          openList();
        } else if (!event.altKey) {
          moveActive(1);
        }
        return;
      case "ArrowUp":
        event.preventDefault();

        if (!open) {
          openList(flatOptions.length - 1);
        } else if (event.altKey) {
          closeList();
        } else {
          moveActive(-1);
        }
        return;
      case "Enter":
        if (open && activeOption) {
          event.preventDefault();
          selectOption(activeOption);
        }
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeList();
        } else if (query) {
          event.preventDefault();
          setQuery(null);
        }
        return;
      case "Tab":
        if (open) {
          closeList();
        }
        return;
      default:
        return;
    }
  }

  const inputValue = query ?? selectedOption?.label ?? "";
  const resultCount = flatOptions.length;

  return (
    <div className={cn("relative min-w-0", className)}>
      <input
        aria-activedescendant={activeOption?.optionId}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-invalid={invalid || ariaInvalid || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        autoComplete="off"
        className={controlClassName(
          cn(inputControlClassName(controlSize), "pr-9"),
        )}
        disabled={disabled}
        id={inputId}
        onBlur={() => {
          if (open) {
            closeList();
          } else {
            setQuery(null);
          }
        }}
        onChange={handleInputChange}
        onClick={() => {
          if (!open) {
            openList();
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={setInputRef}
        required={required}
        role="combobox"
        spellCheck={false}
        type="text"
        value={inputValue}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-text-muted"
      >
        <ChevronDown className="size-4" />
      </span>
      {name ? <input name={name} type="hidden" value={value ?? ""} /> : null}
      <span className="sr-only" id={statusId} role="status">
        {open && query
          ? resultCount === 0
            ? emptyText
            : `${resultCount} results`
          : ""}
      </span>
      <div
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
        className={cn(
          floatingBaseClassName,
          "z-50 max-h-[min(20rem,calc(100dvh-16px))] overflow-y-auto overscroll-contain rounded-md bg-surface p-1.5 shadow-overlay",
        )}
        id={listboxId}
        onMouseDown={(event) => {
          // Keep focus in the input while choosing with the pointer.
          event.preventDefault();
        }}
        popover="manual"
        ref={listboxRef}
        role="listbox"
      >
        {filteredGroups.length === 0 ? (
          <p className="px-2 py-2 text-callout text-text-muted">{emptyText}</p>
        ) : (
          filteredGroups.map((group) => {
            const headingId = `${generatedId}-group-${group.groupIndex}`;

            return (
              <div
                aria-labelledby={headingId}
                key={group.groupIndex}
                role="group"
              >
                <div
                  className="px-2 pt-2 pb-1 text-caption font-medium text-text-muted"
                  id={headingId}
                  role="presentation"
                >
                  {group.label}
                </div>
                {group.options.map((option) => {
                  const isActive = activeOption?.optionId === option.optionId;
                  const isSelected = option.value === value;

                  return (
                    <div
                      aria-selected={isSelected}
                      className={cn(
                        "flex min-h-8 cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-body pointer-coarse:min-h-11",
                        isActive &&
                          "bg-surface-selected outline-2 -outline-offset-2 outline-focus",
                      )}
                      id={option.optionId}
                      key={option.optionId}
                      onClick={() => selectOption(option)}
                      onPointerMove={() => {
                        const index = flatOptions.findIndex(
                          (candidate) => candidate.optionId === option.optionId,
                        );

                        if (index !== activeIndex) {
                          setActiveIndex(index);
                        }
                      }}
                      role="option"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                      {option.meta ? (
                        <span className="shrink-0 text-callout text-text-muted">
                          {option.meta}
                        </span>
                      ) : null}
                      <Check
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0 text-accent",
                          isSelected ? "visible" : "invisible",
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
