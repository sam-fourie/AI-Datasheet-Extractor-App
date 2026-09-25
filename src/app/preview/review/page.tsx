import type { Metadata } from "next";

import {
  ReviewPreview,
  type PreviewFixtureKey,
  type PreviewPdfMode,
} from "@/components/review/review-preview";

export const metadata: Metadata = {
  title: "Review preview",
};

type SearchParams = Record<string, string | string[] | undefined>;

function isPreviewFixtureKey(value: unknown): value is PreviewFixtureKey {
  return value === "large" || value === "rerun" || value === "small";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Internal sandbox (§1.1): the review workspace on the three fixtures
 * (?fixture=small|rerun|large). Saving, re-runs and the PDF viewer are
 * stubbed; ?pdf=error|unavailable shows the other pane states and
 * ?save=fail exercises the save error toast.
 */
export default async function ReviewPreviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const fixture = first(params.fixture);
  const pdf = first(params.pdf);
  const pdfMode: PreviewPdfMode = pdf === "error" || pdf === "unavailable" ? pdf : "ready";

  return (
    <ReviewPreview
      fixture={isPreviewFixtureKey(fixture) ? fixture : "large"}
      pdf={pdfMode}
      saveFails={first(params.save) === "fail"}
    />
  );
}
