"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { Button, TextField } from "@/components/ui";
import { ACTOR_NAME_MAX_LENGTH, normalizeActorName } from "@/lib/identity";

export type NameEntryProps = {
  /** The identity route (`IDENTITY_API_PATH`). */
  action: string;
  /** Where to go once named, already checked with `safeNextPath`. */
  next: string;
};

/**
 * The "Who is this?" field. The name is saved in a cookie on this device and
 * recorded on the extractions, runs and reviews the person makes. Continue
 * does a full page load to `next`, so the root layout renders the app shell.
 * Without JavaScript the form still posts to the identity route.
 */
export function NameEntry({ action, next }: NameEntryProps) {
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function fail(text: string) {
    setSaving(false);
    setMessage(text);
    inputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const value = normalizeActorName(name);

    if (!value) {
      fail("Enter your name.");
      return;
    }

    setSaving(true);
    setMessage(null);

    let response: Response;

    try {
      response = await fetch(action, {
        body: new URLSearchParams({ name: value, next }),
        headers: { Accept: "application/json" },
        method: "POST",
      });
    } catch {
      fail("Check your connection and try again.");
      return;
    }

    const body = (await response.json().catch(() => null)) as { error?: unknown; next?: unknown } | null;

    if (response.ok && typeof body?.next === "string") {
      window.location.replace(body.next);
      return;
    }

    fail(typeof body?.error === "string" ? body.error : "Something went wrong. Try again.");
  }

  return (
    <form action={action} className="flex w-72 flex-col" method="post" onSubmit={handleSubmit}>
      <input name="next" type="hidden" value={next} />
      <TextField
        aria-describedby={messageId}
        aria-label="Your full name"
        autoCapitalize="words"
        autoComplete="name"
        autoFocus
        className="h-11!"
        controlSize="lg"
        enterKeyHint="go"
        invalid={message !== null}
        maxLength={ACTOR_NAME_MAX_LENGTH}
        name="name"
        onChange={(event) => {
          setName(event.target.value);
          setMessage(null);
        }}
        placeholder="Full name"
        readOnly={saving}
        ref={inputRef}
        required
        spellCheck={false}
        value={name}
      />
      <Button className="mt-3 h-11! w-full" loading={saving} size="lg" type="submit" variant="primary">
        Continue
      </Button>
      <p
        aria-live="polite"
        className="mt-4 flex h-5 items-center justify-center text-callout text-danger"
        id={messageId}
        role="status"
      >
        {message}
      </p>
    </form>
  );
}
