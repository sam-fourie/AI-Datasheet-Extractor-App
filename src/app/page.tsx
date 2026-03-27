import { AppPageLayout } from "@/components/app-page-layout";
import { DatasheetIntakeWorkbench } from "@/components/datasheet-intake-workbench";

export default function Home() {
  return (
    <AppPageLayout
      description="Submit a datasheet, persist the full extraction metadata, and start the human review workflow immediately from the saved result."
      title="Intake Workbench"
    >
      <DatasheetIntakeWorkbench />
    </AppPageLayout>
  );
}
