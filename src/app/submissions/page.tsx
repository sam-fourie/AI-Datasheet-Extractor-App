import { connection } from "next/server";

import { AppPageLayout } from "@/components/app-page-layout";
import { SubmissionsArchive } from "@/components/submissions-archive";
import { listSubmissionSummaries } from "@/lib/submissions";

export default async function SubmissionsPage() {
  await connection();
  const submissions = await listSubmissionSummaries();

  return (
    <AppPageLayout
      description="Persistent extraction history for every saved datasheet, including the original AI snapshot and the latest review decisions."
      title="Submissions"
    >
      <SubmissionsArchive initialSubmissions={submissions} />
    </AppPageLayout>
  );
}
