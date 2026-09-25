import type { ReactNode } from "react";

import { Disclosure } from "@/components/ui";

const DEFINITIONS: Array<{ description: ReactNode; term: string }> = [
  {
    description:
      "For a fully reviewed submission, confirmed decisions ÷ all decisions (package + measurements + pins). A model's accuracy is the mean over its reviewed submissions.",
    term: "Accuracy",
  },
  {
    description:
      "For a re-run, matching rows ÷ compared rows against the baseline's reviewed values. Numbers must match exactly and names must match after normalisation; a partial is not a match. Model averages count only runs whose baseline is fully reviewed.",
    term: "Agreement",
  },
  {
    description: "95% and above green, 80 to 94% amber, below 80% red.",
    term: "Score colours",
  },
  {
    description:
      "Time of the model call only (providerMeta.latencyMs), excluding upload and PDF fetch. The median is shown.",
    term: "Latency",
  },
  {
    description:
      "Estimated at run time from list prices × tokens. The actual invoice may differ.",
    term: "Cost",
  },
  {
    description:
      "Corrected ÷ decided for that field across fully reviewed submissions.",
    term: "Correction rate",
  },
  {
    description:
      "Runs without usage metadata are excluded from latency and cost, and each column shows its n.",
    term: "Legacy runs",
  },
  {
    description:
      "Older corrections that did not record a status are read by their value: a correction to “Not found in datasheet” counts as not found, and a corrected value on a field the AI marked “Not found” now counts as a found value. This changed agreement scores for some legacy reviews.",
    term: "Legacy corrections",
  },
];

/** "How these numbers work" (spec §6.3 plus addendum L). */
export function MetricDefinitions() {
  return (
    <section
      aria-labelledby="definitions-heading"
      className="scroll-mt-[calc(var(--ui-topbar-height)+16px)] lg:scroll-mt-6"
      id="definitions"
    >
      <Disclosure
        contentClassName="pt-4 pl-5"
        summary={
          <h2 className="text-title-2 text-text" id="definitions-heading">
            How these numbers work
          </h2>
        }
      >
        <dl className="grid max-w-3xl gap-x-8 gap-y-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          {DEFINITIONS.map((definition) => (
            <div className="contents" key={definition.term}>
              <dt className="text-callout font-medium text-text">{definition.term}</dt>
              <dd className="-mt-3 text-callout text-text-muted sm:mt-0">
                {definition.description}
              </dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </section>
  );
}
