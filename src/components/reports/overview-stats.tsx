import { Stat, StatGroup, type StatTone } from "@/components/ui";
import { formatUsd } from "@/lib/ai/provider-meta";
import type { ReportsOverview } from "@/lib/submissions/reports";
import { scoreTone } from "@/lib/submissions/score";

import { EMPTY_VALUE, formatPercent, pluralize } from "./report-format";

function toneFor(value: number | null): StatTone {
  const tone = scoreTone(value);

  return tone === "neutral" ? "neutral" : tone;
}

/** The five headline numbers (spec §6.1) for the filtered scope. */
export function OverviewStats({ overview }: { overview: ReportsOverview }) {
  return (
    <StatGroup columnsFrom="xl">
      <Stat
        caption={`of ${pluralize(overview.baselineRuns, "baseline")}`}
        label="Reviewed datasheets"
        value={overview.reviewedDatasheets.toLocaleString("en-US")}
      />
      <Stat
        caption={
          overview.accuracySubmissions > 0
            ? `across ${pluralize(overview.accuracySubmissions, "reviewed submission")}`
            : "No reviewed submissions"
        }
        label="Average accuracy"
        tone={toneFor(overview.averageAccuracy)}
        value={formatPercent(overview.averageAccuracy)}
      />
      <Stat
        caption={
          overview.scoredRuns > 0
            ? `across ${pluralize(overview.scoredRuns, "run")} vs reviewed baselines`
            : "No runs vs reviewed baselines"
        }
        label="Average agreement"
        tone={toneFor(overview.averageAgreement)}
        value={formatPercent(overview.averageAgreement)}
      />
      <Stat
        caption={
          // Each segment stays on one line so "re-runs" never breaks at its hyphen.
          <>
            <span className="whitespace-nowrap">{pluralize(overview.baselineRuns, "baseline")}</span>
            {" · "}
            <span className="whitespace-nowrap">{pluralize(overview.rerunRuns, "re-run")}</span>
          </>
        }
        label="Model runs"
        value={overview.totalRuns.toLocaleString("en-US")}
      />
      <Stat
        caption={
          overview.costRuns > 0
            ? `${pluralize(overview.costRuns, "run")} with cost data`
            : "No runs with cost data"
        }
        label="Estimated spend"
        value={
          overview.estimatedSpendUsd === null
            ? EMPTY_VALUE
            : formatUsd(overview.estimatedSpendUsd)
        }
      />
    </StatGroup>
  );
}
