"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { AppStatusPage } from "@/components/app-page-layout";
import { Button, LinkButton } from "@/components/ui";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppStatusPage
      actions={
        <>
          <Button onClick={() => unstable_retry()} variant="primary">
            Try again
          </Button>
          <LinkButton href="/submissions" variant="secondary">
            Go to submissions
          </LinkButton>
        </>
      }
      description="We couldn't load this page."
      detail={error.digest ? `Error ${error.digest}` : null}
      icon={<TriangleAlert />}
      title="Something went wrong"
    />
  );
}
