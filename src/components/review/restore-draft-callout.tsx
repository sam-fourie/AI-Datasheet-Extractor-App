"use client";

import { History } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { Button, Callout } from "@/components/ui";

export type RestoreDraftCalloutProps = {
  onDiscard: () => void;
  onRestore: () => void;
  /** Epoch ms of the unsaved draft. */
  savedAt: number;
};

/**
 * Unsaved review work found in this browser for the same saved version
 * (addendum S): "You have unsaved review changes from 5 min ago."
 */
export function RestoreDraftCallout({ onDiscard, onRestore, savedAt }: RestoreDraftCalloutProps) {
  return (
    <Callout
      actions={
        <>
          <Button onClick={onRestore} size="sm" variant="secondary">
            Restore
          </Button>
          <Button onClick={onDiscard} size="sm" variant="ghost">
            Discard
          </Button>
        </>
      }
      icon={<History />}
      role="status"
      tone="neutral"
    >
      You have unsaved review changes from <RelativeTime iso={new Date(savedAt).toISOString()} />.
    </Callout>
  );
}
