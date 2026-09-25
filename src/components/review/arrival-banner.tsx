"use client";

import { CircleCheck } from "lucide-react";

import { Button, Callout } from "@/components/ui";
import { formatLatency } from "@/lib/ai/provider-meta";

import { pluralize } from "./workspace-model";

export type ArrivalStats = {
  flagged: number;
  latencyMs: number | null;
  measurements: number;
  pins: number;
};

export type ArrivalBannerProps = {
  onDismiss: () => void;
  /** Sets the filter to Needs attention. */
  onStartWithFlagged: () => void;
  stats: ArrivalStats;
};

/**
 * Shown once after the intake hands off a new extraction (addendum A):
 * "Extraction saved · 23.4 s · 10 measurements · 8 pins · 3 flagged by the AI".
 */
export function ArrivalBanner({ onDismiss, onStartWithFlagged, stats }: ArrivalBannerProps) {
  const parts = [
    "Extraction saved",
    stats.latencyMs !== null ? formatLatency(stats.latencyMs) : null,
    pluralize(stats.measurements, "measurement"),
    pluralize(stats.pins, "pin"),
    stats.flagged > 0 ? `${stats.flagged} flagged by the AI` : null,
  ].filter(Boolean);

  return (
    <Callout
      actions={
        stats.flagged > 0 ? (
          <Button onClick={onStartWithFlagged} size="sm" variant="secondary">
            Start with flagged rows
          </Button>
        ) : null
      }
      dismissible
      icon={<CircleCheck />}
      onDismiss={onDismiss}
      role="status"
      tone="accent"
    >
      <span className="tabular-nums">{parts.join(" · ")}</span>
    </Callout>
  );
}
