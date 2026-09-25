import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";

import { AppStatusPage } from "@/components/app-page-layout";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
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
      description="The page you're looking for doesn't exist or was deleted."
      icon={<FileQuestion />}
      title="Page not found"
    />
  );
}
