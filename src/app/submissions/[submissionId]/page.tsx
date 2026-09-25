import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { InitialPdfViewer } from "@/components/review/review-services";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { formatReviewPageTitle } from "@/components/review/workspace-model";
import { getDefaultExtractionSettings } from "@/lib/ai/settings";
import { buildBaselineRunHints } from "@/lib/submissions/agreement";
import { resolvePdfViewer } from "@/lib/submissions/pdf-viewer";
import {
  findNextPendingBaseline,
  getSubmissionDetail,
  listSubmissionModelRuns,
} from "@/lib/submissions/repository";
import type { SubmissionDetail } from "@/lib/submissions/types";

/** Shared by generateMetadata and the page, so Mongo is read once per request (React cache). */
const getSubmission = cache(getSubmissionDetail);

async function loadPdfViewer(submission: SubmissionDetail): Promise<InitialPdfViewer> {
  try {
    return await resolvePdfViewer(submission);
  } catch (error) {
    const { sourceMeta } = submission.intake;

    return {
      message: error instanceof Error ? error.message : "The datasheet couldn't be loaded.",
      originalUrl: sourceMeta.kind === "url" ? sourceMeta.normalizedUrl : null,
      status: "error",
    };
  }
}

export async function generateMetadata(
  props: PageProps<"/submissions/[submissionId]">,
): Promise<Metadata> {
  const { submissionId } = await props.params;
  const submission = await getSubmission(submissionId);

  return {
    title: submission ? formatReviewPageTitle(submission) : "Submission not found",
  };
}

export default async function SubmissionReviewPage(
  props: PageProps<"/submissions/[submissionId]">,
) {
  const { submissionId } = await props.params;
  const submission = await getSubmission(submissionId);

  if (!submission) {
    notFound();
  }

  const rootId = submission.comparison?.baselineSubmissionId ?? submission.submissionId;
  const [runs, pdfViewer, nextReview, defaults] = await Promise.all([
    listSubmissionModelRuns(rootId),
    loadPdfViewer(submission),
    findNextPendingBaseline(submission.submissionId).catch(() => null),
    Promise.resolve(getDefaultExtractionSettings()),
  ]);

  return (
    <ReviewWorkspace
      defaultSettings={{ model: defaults.model, reasoningEffort: defaults.reasoningEffort }}
      initialSubmission={submission}
      key={submission.submissionId}
      nextReview={nextReview}
      pdfViewer={pdfViewer}
      runHints={submission.comparison ? null : buildBaselineRunHints(runs)}
      runs={runs}
    />
  );
}
