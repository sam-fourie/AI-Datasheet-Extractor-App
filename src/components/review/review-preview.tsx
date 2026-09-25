"use client";

import { useMemo, useSyncExternalStore } from "react";

import { AppLink } from "@/components/app-link";
import { cn } from "@/components/ui";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import { buildBaselineRunHints } from "@/lib/submissions/agreement";
import {
  countReviewDecisions,
  deriveSubmissionReviewStatus,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import type { SubmissionDetail, SubmissionModelRun } from "@/lib/submissions/types";

import {
  largeBaselineFixture,
  largeRunsFixture,
  ne555RunsFixture,
  rerunFixture,
  smallBaselineFixture,
  smallRunsFixture,
} from "./fixtures";
import type { InitialPdfViewer, PdfViewerResult, ReviewWorkspaceServices } from "./review-services";
import { ReviewWorkspace } from "./review-workspace";

export type PreviewFixtureKey = "large" | "rerun" | "small";
export type PreviewPdfMode = "error" | "ready" | "unavailable";

const FIXTURES: Record<
  PreviewFixtureKey,
  { label: string; runs: SubmissionModelRun[]; submission: SubmissionDetail }
> = {
  large: { label: "108 pins, unreviewed", runs: largeRunsFixture, submission: largeBaselineFixture },
  rerun: { label: "8-pin re-run", runs: ne555RunsFixture, submission: rerunFixture },
  small: { label: "3 pins, reviewed", runs: smallRunsFixture, submission: smallBaselineFixture },
};

const FIXTURE_ORDER: PreviewFixtureKey[] = ["small", "rerun", "large"];

/* ------------------------------ Preview PDF ------------------------------- */

/** A plain multi-page PDF ("Preview datasheet · page N") so the pane has pages to jump to. */
function buildPreviewPdf(partNumber: string, pageCount: number) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const safeTitle = partNumber.replace(/[()\\]/g, "");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (let page = 1; page <= pageCount; page += 1) {
    const pageId = 2 + page * 2;
    const contentId = pageId + 1;
    const stream = `BT /F1 28 Tf 72 700 Td (${safeTitle}) Tj ET BT /F1 18 Tf 72 660 Td (Preview datasheet, page ${page}) Tj ET`;

    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = body.length;

  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Blob([body], { type: "application/pdf" });
}

const pdfUrls = new Map<string, string>();

function previewPdfUrl(submission: SubmissionDetail) {
  let url = pdfUrls.get(submission.submissionId);

  if (!url) {
    const pages = [
      ...submission.extraction.fields.flatMap((field) => field.evidencePages ?? []),
      ...submission.extraction.pinRows.flatMap((pin) => pin.evidencePages ?? []),
    ];
    const pageCount = Math.min(Math.max(4, ...pages), 150);

    url = URL.createObjectURL(buildPreviewPdf(submission.intake.partNumber, pageCount));
    pdfUrls.set(submission.submissionId, url);
  }

  return url;
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/* -------------------------------- Services -------------------------------- */

function buildServices(
  fixture: PreviewFixtureKey,
  pdf: PreviewPdfMode,
  saveFails: boolean,
): ReviewWorkspaceServices {
  const { submission } = FIXTURES[fixture];
  const hrefByid = new Map<string, string>();

  for (const key of FIXTURE_ORDER) {
    const entry = FIXTURES[key];

    hrefByid.set(entry.submission.submissionId, `/preview/review?fixture=${key}`);

    for (const run of entry.runs) {
      if (!hrefByid.has(run.submissionId)) {
        hrefByid.set(run.submissionId, `/preview/review?fixture=${run.isBaseline ? key : "rerun"}`);
      }
    }
  }

  hrefByid.set("fx-ne555-baseline", "/preview/review?fixture=rerun");

  return {
    canDelete: false,
    async ensurePdfViewer(): Promise<PdfViewerResult> {
      await delay(900);

      if (pdf === "unavailable") {
        return { reason: "not-retained", status: "unavailable" };
      }

      if (pdf === "error") {
        return {
          message: "The site didn't send the PDF.",
          originalUrl: "https://www.ti.com/lit/ds/symlink/ne555.pdf",
          status: "error",
        };
      }

      return {
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        fileName: "preview-datasheet.pdf",
        revision: fixture === "rerun" ? "latest-copy" : "extracted",
        sizeBytes: null,
        source: "upload",
        status: "ready",
        url: previewPdfUrl(submission),
      };
    },
    hrefFor: (submissionId) => hrefByid.get(submissionId) ?? `/preview/review?fixture=${fixture}`,
    pdfDownloadHref: () => null,
    pdfTabHref: (_submissionId, page, available) => {
      if (!available || pdf !== "ready") {
        return null;
      }

      return `${previewPdfUrl(submission)}${page ? `#page=${page}` : ""}`;
    },
    async rerun(_submissionId, settings, signal) {
      await delay(6000, signal);

      return {
        ...rerunFixture,
        providerMeta: { ...rerunFixture.providerMeta, ...settings },
        submissionId: `fx-preview-run-${Date.now()}`,
      };
    },
    async saveReview(_submissionId, payload) {
      await delay(600);

      if (saveFails) {
        throw new Error("The preview is set to fail saves (?save=fail).");
      }

      const review = normalizeSubmissionReview(submission.extraction, payload);
      const reviewStatus = deriveSubmissionReviewStatus(review);
      const now = new Date().toISOString();

      return {
        ...submission,
        review,
        reviewDecisionCounts: countReviewDecisions(review),
        reviewStatus,
        reviewedAt: reviewStatus === "reviewed" ? now : null,
        updatedAt: now,
      };
    },
  };
}

export type ReviewPreviewProps = {
  fixture: PreviewFixtureKey;
  pdf: PreviewPdfMode;
  saveFails: boolean;
};

/**
 * /preview/review: the real workspace on the fixtures, with every network
 * call stubbed (saving, re-runs and the PDF viewer never reach the API).
 */
function subscribeNever() {
  return () => {};
}

export function ReviewPreview({ fixture, pdf, saveFails }: ReviewPreviewProps) {
  const { runs, submission } = FIXTURES[fixture];
  const services = useMemo(() => buildServices(fixture, pdf, saveFails), [fixture, pdf, saveFails]);
  // Client-only: the preview PDF is a blob URL that doesn't exist on the server.
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  if (!isClient) {
    return (
      <p className="px-4 py-6 text-callout text-text-muted" role="status">
        Loading the review preview…
      </p>
    );
  }

  const initialViewer: InitialPdfViewer =
    pdf === "unavailable"
      ? { reason: "not-retained", status: "unavailable" }
      : { fileName: "preview-datasheet.pdf", originalUrl: "https://www.ti.com/lit/ds/symlink/ne555.pdf", status: "uncached" };

  return (
    <>
      {/* The app's mobile top bar is only non-sticky on /submissions/[id]; match that here. */}
      <style>{`@media (max-width: 1023.98px){body header.sticky.lg\\:hidden{position:relative}}`}</style>
      <nav
        aria-label="Preview fixtures"
        className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border bg-surface-subtle px-3 py-2 lg:px-4"
      >
        <span className="mr-2 text-caption text-text-muted">Review preview</span>
        {FIXTURE_ORDER.map((key) => (
          <AppLink
            aria-current={key === fixture ? "page" : undefined}
            className={cn(
              "rounded-xs px-2 py-1 text-callout pointer-coarse:min-h-11 pointer-coarse:py-3",
              key === fixture
                ? "bg-surface-selected font-medium text-text"
                : "text-text-muted hover:bg-surface-hover hover:text-text",
            )}
            href={`/preview/review?fixture=${key}${pdf !== "ready" ? `&pdf=${pdf}` : ""}`}
            key={key}
          >
            {FIXTURES[key].label}
          </AppLink>
        ))}
        <span className="ml-auto text-caption text-text-muted">Saving is stubbed · {formatRunLabel(submission.providerMeta)}</span>
      </nav>
      <ReviewWorkspace
        defaultSettings={{ model: "gpt-5.6-terra", reasoningEffort: "high" }}
        initialSubmission={submission}
        key={`${fixture}-${pdf}`}
        nextReview={
          fixture === "large"
            ? { partNumber: "MMBT3904LT1G", submissionId: smallBaselineFixture.submissionId }
            : { partNumber: "CY8C5668AXI-LP010", submissionId: largeBaselineFixture.submissionId }
        }
        pdfViewer={initialViewer}
        runHints={submission.comparison ? null : buildBaselineRunHints(runs)}
        runs={runs}
        services={services}
      />
    </>
  );
}
