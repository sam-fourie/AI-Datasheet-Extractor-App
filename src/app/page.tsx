import { connection } from "next/server";

import { AppPageLayout } from "@/components/app-page-layout";
import { DatasheetIntakeWorkbench } from "@/components/datasheet-intake-workbench";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";

export default async function Home() {
  // Read the model defaults at request time so env changes apply without a rebuild.
  await connection();

  const defaultSettings = getDefaultExtractionSettings();

  return (
    <AppPageLayout
      description="Submit a datasheet, persist the full extraction metadata, and start the human review workflow immediately from the saved result."
      title="Intake Workbench"
    >
      <DatasheetIntakeWorkbench
        defaultModel={defaultSettings.model}
        defaultReasoningEffort={defaultSettings.reasoningEffort}
      />
    </AppPageLayout>
  );
}
