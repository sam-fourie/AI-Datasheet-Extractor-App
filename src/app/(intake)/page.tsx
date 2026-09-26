import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppPageLayout } from "@/components/app-page-layout";
import type { ModelRunEstimate } from "@/components/intake/intake-helpers";
import {
  INTAKE_PAGE_META,
  INTAKE_PAGE_TITLE,
  IntakeSkeleton,
} from "@/components/intake/intake-skeleton";
import { NewExtractionForm } from "@/components/intake/new-extraction-form";
import { RecentExtractions } from "@/components/intake/recent-extractions";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";
import { summarizeModelRuns } from "@/lib/submissions/model-stats";
import { listDatasheetIndex, listRunMetaSummaries } from "@/lib/submissions/repository";
import type { DatasheetIndexEntry } from "@/lib/submissions/types";

export const metadata: Metadata = {
  // Spelled out in full so the tab title never depends on where the root
  // layout's title template applies.
  title: { absolute: "New extraction · AI Datasheet Extractor" },
};

async function loadIndex(): Promise<DatasheetIndexEntry[] | null> {
  try {
    return await listDatasheetIndex();
  } catch (error) {
    console.error("Could not load the datasheet index for intake.", error);
    return null;
  }
}

async function loadEstimates(): Promise<ModelRunEstimate[] | null> {
  try {
    return summarizeModelRuns(await listRunMetaSummaries()).map((stats) => ({
      averageCostUsd: stats.averageCostUsd,
      medianLatencyMs: stats.medianLatencyMs,
      model: stats.model,
      p90LatencyMs: stats.p90LatencyMs,
      reasoningEffort: stats.reasoningEffort,
      runs: stats.runs,
    }));
  } catch (error) {
    console.error("Could not load model benchmarks for intake.", error);
    return null;
  }
}

/**
 * Everything that waits on Mongo. The index scan takes most of a second, so it
 * streams behind a skeleton instead of holding the whole route (and the click
 * that navigated here). The form only renders once the index is known, so
 * duplicate detection is never skipped by a fast submit.
 */
async function IntakeBody() {
  // Read the model defaults and the index at request time so changes apply without a rebuild.
  await connection();

  const defaultSettings = getDefaultExtractionSettings();
  const [index, estimates] = await Promise.all([loadIndex(), loadEstimates()]);

  return (
    <>
      <NewExtractionForm
        defaultModel={defaultSettings.model}
        defaultReasoningEffort={defaultSettings.reasoningEffort}
        estimates={estimates}
        index={index}
      />
      {index ? <RecentExtractions entries={index.slice(0, 3)} /> : null}
    </>
  );
}

export default function NewExtractionPage() {
  return (
    <AppPageLayout meta={INTAKE_PAGE_META} title={INTAKE_PAGE_TITLE} width="narrow">
      <Suspense fallback={<IntakeSkeleton />}>
        <IntakeBody />
      </Suspense>
    </AppPageLayout>
  );
}
