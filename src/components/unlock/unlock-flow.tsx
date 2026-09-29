"use client";

import { useState } from "react";

import { NameEntry } from "./name-entry";
import { PinEntry } from "./pin-entry";

export type UnlockFlowProps = {
  /** The last PIN attempt without JavaScript was wrong (`?error=1`). */
  failed: boolean;
  /** `IDENTITY_API_PATH`. */
  identityAction: string;
  /** "name" when the device is already unlocked but hasn't said who it is. */
  initialStep: "name" | "pin";
  /** Where to go once signed in, already checked with `safeNextPath`. */
  next: string;
  /** `UNLOCK_API_PATH`. */
  pinAction: string;
  /** Digits in the PIN (`APP_PIN.length`). */
  pinLength: number;
};

/**
 * Sign-in on the PIN screen: the PIN boxes, then "Who is this?" when this
 * device has no name yet. Both steps share the page's brand mark.
 */
export function UnlockFlow({
  failed,
  identityAction,
  initialStep,
  next,
  pinAction,
  pinLength,
}: UnlockFlowProps) {
  const [step, setStep] = useState(initialStep);

  if (step === "name") {
    return (
      <div className="flex flex-col items-center text-center motion-safe:animate-fade-in">
        <h1 className="text-title-1 text-text">Who is this?</h1>
        <p className="mt-1 max-w-72 text-body text-text-muted">
          Your name is shown next to the extractions and reviews you do.
        </p>
        <div className="mt-8">
          <NameEntry action={identityAction} next={next} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-title-1 text-text">Enter PIN</h1>
      <p className="mt-1 text-body text-text-muted">AI Datasheet Extractor</p>
      <div className="mt-10">
        <PinEntry
          action={pinAction}
          failed={failed}
          length={pinLength}
          next={next}
          onNeedsName={() => setStep("name")}
        />
      </div>
    </div>
  );
}
