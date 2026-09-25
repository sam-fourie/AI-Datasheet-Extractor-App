import { FileQuestion } from "lucide-react";

import { AppStatusPage } from "@/components/app-page-layout";
import { LinkButton } from "@/components/ui";

/** A missing or deleted submission (§4.3). The page's generateMetadata sets the title. */
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
