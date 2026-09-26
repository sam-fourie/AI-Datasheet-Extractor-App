import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";

import { AppStatusPage } from "@/components/app-page-layout";
import { LinkButton } from "@/components/ui";

/**
 * Shown for a missing or deleted submission (§4.3). It sits at the
 * submissions segment, not under [submissionId], because the review route's
 * layout calls notFound() and a segment's own not-found boundary sits inside
 * its layout. The page's own notFound() (a submission deleted mid-request)
 * lands here too.
 *
 * Next.js reads this file's metadata for the 404 response, so the tab title
 * stays specific even though the page's generateMetadata never runs.
 */
export const metadata: Metadata = {
  title: "Submission not found",
};

export default function SubmissionNotFound() {
  return (
    <AppStatusPage
      actions={
        <>
          <LinkButton href="/submissions" variant="primary">
            Go to submissions
          </LinkButton>
          <LinkButton href="/" variant="secondary">
            New extraction
          </LinkButton>
        </>
      }
      description="It may have been deleted, or the link is incomplete."
      icon={<FileQuestion />}
      title="This submission doesn't exist"
    />
  );
}
