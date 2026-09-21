import { notFound } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { AppPageLayout } from "@/components/app-page-layout";
import { SubmissionReviewEditor } from "@/components/submission-review-editor";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";
import {
  getSubmissionDetail,
  listSubmissionModelRuns,
} from "@/lib/submissions";

const backLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-pill border border-border bg-surface px-4 text-sm font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await getSubmissionDetail(submissionId);

  if (!submission) {
    notFound();
  }

  const rootSubmissionId =
    submission.comparison?.baselineSubmissionId ?? submission.submissionId;
  const modelRuns = await listSubmissionModelRuns(rootSubmissionId);
  const defaultSettings = getDefaultExtractionSettings();

  return (
    <AppPageLayout
      action={
        <AppLink className={backLinkClassName} href="/submissions">
          Back to submissions
        </AppLink>
      }
      description="Review the saved submission, preserve the immutable extraction snapshot, and update the latest human correction layer."
      title={submission.intake.partNumber}
    >
      <SubmissionReviewEditor
        defaultModel={defaultSettings.model}
        defaultReasoningEffort={defaultSettings.reasoningEffort}
        initialSubmission={submission}
        modelRuns={modelRuns}
      />
    </AppPageLayout>
  );
}
