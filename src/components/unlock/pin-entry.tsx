"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Check } from "lucide-react";

import { cn, Spinner } from "@/components/ui";

export type PinEntryProps = {
  /** The unlock route (`UNLOCK_API_PATH`). */
  action: string;
  /** The last attempt without JavaScript was wrong (`?error=1`). */
  failed?: boolean;
  /** Digits in the PIN (`APP_PIN.length`): one box each. */
  length: number;
  /** Where to go once unlocked, already checked with `safeNextPath`. */
  next: string;
  /** The PIN was right but this device has no name yet: show "Who is this?". */
  onNeedsName: () => void;
};

type Status = "idle" | "checking" | "rejected" | "success";

const WRONG_PIN_MESSAGE = "Incorrect PIN. Try again.";
/** How long a wrong PIN shakes and stays red before it clears (animate-shake). */
const REJECT_MS = 450;
/** How long the boxes stay green before the name step replaces them. */
const ACCEPT_MS = 350;

/**
 * The PIN boxes. One real input sits invisibly over the boxes, so typing,
 * paste, Backspace, the numeric keypad and screen readers all behave natively,
 * and the boxes only draw its value. The last digit checks the PIN right away.
 * A wrong PIN shakes and clears. The right one either hands over to the name
 * step (`onNeedsName`) or does a full page load to `next`, because the root
 * layout rendered this screen without the app shell. Without JavaScript the
 * form still posts to the unlock route.
 */
export function PinEntry({ action, failed = false, length, next, onNeedsName }: PinEntryProps) {
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<number | null>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(failed ? WRONG_PIN_MESSAGE : null);
  const busy = status !== "idle";
  // The next box to fill. It only lights up while the input has focus, through
  // CSS focus-within, which also covers the browser's autofocus before React
  // hydrates.
  const activeIndex = !busy && value.length < length ? value.length : -1;

  useEffect(
    () => () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  /** Typing always continues from the end, like separate boxes would. */
  function keepCaretAtEnd() {
    const input = inputRef.current;

    if (input) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function startOver(text: string, shake: boolean) {
    setMessage(text);

    if (!shake) {
      setStatus("idle");
      setValue("");
      inputRef.current?.focus();
      return;
    }

    setStatus("rejected");
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      setStatus("idle");
      setValue("");
      inputRef.current?.focus();
    }, REJECT_MS);
  }

  async function check(pin: string) {
    setStatus("checking");
    setMessage(null);

    let response: Response;

    try {
      response = await fetch(action, {
        body: new URLSearchParams({ next, pin }),
        headers: { Accept: "application/json" },
        method: "POST",
      });
    } catch {
      startOver("Check your connection and try again.", false);
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      needsName?: unknown;
      next?: unknown;
    } | null;

    if (response.ok && typeof body?.next === "string") {
      setStatus("success");

      if (body.needsName === true) {
        clearTimerRef.current = window.setTimeout(() => {
          clearTimerRef.current = null;
          onNeedsName();
        }, ACCEPT_MS);
      } else {
        window.location.replace(body.next);
      }

      return;
    }

    if (response.status === 401) {
      startOver(WRONG_PIN_MESSAGE, true);
    } else {
      startOver("Something went wrong. Try again.", false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (busy) {
      return;
    }

    const digits = event.target.value.replace(/\D/g, "").slice(0, length);

    setValue(digits);

    if (digits.length > 0) {
      setMessage(null);
    }

    if (digits.length === length) {
      void check(digits);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!busy && value.length === length) {
      void check(value);
    }
  }

  return (
    <form action={action} className="flex flex-col items-center" method="post" onSubmit={handleSubmit}>
      <input name="next" type="hidden" value={next} />
      <div className="group/pin relative">
        <div
          aria-hidden="true"
          className={cn("flex gap-3", status === "rejected" && "motion-safe:animate-shake")}
        >
          {Array.from({ length }, (_, index) => {
            const digit = value[index];
            const active = index === activeIndex;

            return (
              <div
                className={cn(
                  "flex h-18 w-15 items-center justify-center rounded-md border bg-surface text-code text-text tabular-nums transition-[border-color,box-shadow,color] duration-(--ui-duration-fast) ease-ui",
                  status === "rejected"
                    ? "border-danger text-danger"
                    : status === "success"
                      ? "border-success"
                      : active
                        ? "border-control-border group-focus-within/pin:border-accent group-focus-within/pin:ring-4 group-focus-within/pin:ring-accent-soft"
                        : "border-control-border",
                )}
                key={index}
              >
                {digit ? (
                  <span className="motion-safe:animate-digit-in" key={digit}>
                    {digit}
                  </span>
                ) : active ? (
                  <span className="hidden h-8 w-0.5 rounded-pill bg-accent group-focus-within/pin:block motion-safe:animate-caret-blink" />
                ) : null}
              </div>
            );
          })}
        </div>
        <input
          aria-describedby={statusId}
          aria-invalid={message === WRONG_PIN_MESSAGE ? true : undefined}
          aria-label="PIN"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          autoFocus
          className="absolute inset-0 size-full cursor-text border-0 bg-transparent p-0 text-base text-transparent caret-transparent outline-none selection:bg-transparent"
          data-1p-ignore="true"
          data-form-type="other"
          data-lpignore="true"
          enterKeyHint="go"
          inputMode="numeric"
          maxLength={length}
          name="pin"
          onChange={handleChange}
          onFocus={keepCaretAtEnd}
          onSelect={keepCaretAtEnd}
          pattern="[0-9]*"
          readOnly={busy}
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={value}
        />
      </div>
      <p
        aria-live="polite"
        className={cn(
          "mt-6 flex h-5 items-center justify-center gap-1.5 text-callout",
          message ? "text-danger" : "text-text-muted",
        )}
        id={statusId}
        role="status"
      >
        {status === "checking" ? (
          <>
            <Spinner size={16} />
            <span className="sr-only">Checking the PIN</span>
          </>
        ) : status === "success" ? (
          <>
            <Check aria-hidden="true" className="size-4 text-success" strokeWidth={2.5} />
            <span className="sr-only">Unlocked</span>
          </>
        ) : (
          message
        )}
      </p>
    </form>
  );
}
