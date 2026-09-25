"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";

import "./globals.css";

export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-page text-text">
        <title>Something went wrong · AI Datasheet Extractor</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-(--ui-content-narrow) flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <div
            aria-hidden="true"
            className="mb-4 flex size-14 items-center justify-center rounded-pill bg-surface-muted text-text-muted [&_svg]:size-8 [&_svg]:stroke-[1.5]"
          >
            <TriangleAlert />
          </div>
          <h1 className="text-title-3 text-text">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-callout text-text-muted">
            We couldn&apos;t load this page.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-caption break-all text-text-muted">
              Error {error.digest}
            </p>
          ) : null}
          <div className="mt-5">
            <Button onClick={() => unstable_retry()} variant="primary">
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
