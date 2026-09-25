/**
 * One threshold map for every percentage score in the app: review accuracy and
 * re-run agreement share the same bands so their colours mean the same thing.
 */

export type ScoreTone = "success" | "warning" | "danger" | "neutral";

export const SCORE_BANDS = [
  { label: "95% and above", min: 95, tone: "success" },
  { label: "80 to 94%", min: 80, tone: "warning" },
  { label: "Below 80%", min: 0, tone: "danger" },
] as const satisfies ReadonlyArray<{ label: string; min: number; tone: ScoreTone }>;

export function scoreTone(percentage: number | null | undefined): ScoreTone {
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    return "neutral";
  }

  for (const band of SCORE_BANDS) {
    if (percentage >= band.min) {
      return band.tone;
    }
  }

  return "danger";
}
