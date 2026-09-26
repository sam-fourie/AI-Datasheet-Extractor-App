import { notFound } from "next/navigation";

import { isValidSubmissionId, submissionExists } from "@/lib/submissions/repository";

/**
 * Answers unknown submission ids with a real HTTP 404.
 *
 * Once this segment's loading.tsx skeleton starts streaming, the response
 * status is locked at 200, so a notFound() from the page can only render the
 * not-found UI. loading.tsx does not wrap the layout of its own segment, so
 * checking here runs before anything streams. The check is a lean indexed
 * lookup; the page still loads the full submission. notFound() thrown here is
 * handled by src/app/submissions/not-found.tsx, the parent segment's boundary.
 */
export default async function SubmissionLayout({
  children,
  params,
}: LayoutProps<"/submissions/[submissionId]">) {
  const { submissionId } = await params;

  if (!isValidSubmissionId(submissionId) || !(await submissionExists(submissionId))) {
    notFound();
  }

  return children;
}
