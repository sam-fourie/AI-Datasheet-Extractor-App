import type {
  PdfViewerState,
  SubmissionDetail,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

/*
 * The network side of the review workspace. The live implementation talks to
 * the route handlers; /preview/review passes stubs so fixtures never touch
 * the API. Client-safe: fetch only, no server imports.
 */

export type ReadyPdfViewer = Extract<PdfViewerState, { status: "ready" }>;

/** Result of asking the server for a viewable PDF (POST /pdf/viewer). */
export type PdfViewerResult =
  | ReadyPdfViewer
  | { reason: "not-retained"; status: "unavailable" }
  | { message: string; originalUrl: string | null; status: "error" };

/**
 * What the server page hands the workspace. `error` covers a resolver failure
 * (R2 not configured, network): the pane shows its error state with Try again.
 */
export type InitialPdfViewer =
  | PdfViewerState
  | { message: string; originalUrl: string | null; status: "error" };

export type RerunSettings = { model: string; reasoningEffort: string };

export type ReviewWorkspaceServices = {
  /** Whether "Delete submission…" is offered (false in the preview). */
  canDelete: boolean;
  /** POST /pdf/viewer: a fresh signed URL, caching URL sources on first use. */
  ensurePdfViewer: (submissionId: string) => Promise<PdfViewerResult>;
  /** Review page of a submission (the preview maps fixture ids to preview URLs). */
  hrefFor: (submissionId: string) => string;
  /** GET /pdf?download=1 (uploads): an attachment copy. Null when not available. */
  pdfDownloadHref: (submissionId: string, available: boolean) => string | null;
  /** GET /pdf in a new tab: the signed copy, at a page. Null when not available. */
  pdfTabHref: (submissionId: string, page: number | null, available: boolean) => string | null;
  /** POST /rerun. Resolves with the new run. */
  rerun: (
    submissionId: string,
    settings: RerunSettings,
    signal: AbortSignal,
  ) => Promise<SubmissionDetail>;
  /** PATCH /review with the unchanged full-overlay payload. Resolves with the saved submission. */
  saveReview: (submissionId: string, review: SubmissionHumanReview) => Promise<SubmissionDetail>;
};

function readErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    if (typeof record.error === "string" && record.error) {
      return record.error;
    }

    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
  }

  return fallback;
}

function isSubmissionDetail(body: unknown): body is SubmissionDetail {
  return Boolean(
    body &&
      typeof body === "object" &&
      typeof (body as Record<string, unknown>).submissionId === "string" &&
      (body as Record<string, unknown>).review,
  );
}

function submissionPath(submissionId: string) {
  return `/api/submissions/${encodeURIComponent(submissionId)}`;
}

export const liveReviewServices: ReviewWorkspaceServices = {
  canDelete: true,

  async ensurePdfViewer(submissionId) {
    let response: Response;

    try {
      response = await fetch(`${submissionPath(submissionId)}/pdf/viewer`, { method: "POST" });
    } catch {
      return { message: "Check your connection and try again.", originalUrl: null, status: "error" };
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (body?.status === "ready" && typeof body.url === "string") {
      return body as unknown as ReadyPdfViewer;
    }

    if (body?.status === "unavailable") {
      return { reason: "not-retained", status: "unavailable" };
    }

    return {
      message: readErrorMessage(body, "The datasheet couldn't be loaded."),
      originalUrl: typeof body?.originalUrl === "string" ? body.originalUrl : null,
      status: "error",
    };
  },

  hrefFor(submissionId) {
    return `/submissions/${encodeURIComponent(submissionId)}`;
  },

  pdfDownloadHref(submissionId, available) {
    return available ? `${submissionPath(submissionId)}/pdf?download=1` : null;
  },

  pdfTabHref(submissionId, page, available) {
    if (!available) {
      return null;
    }

    const query = page && page > 0 ? `?page=${page}` : "";

    return `${submissionPath(submissionId)}/pdf${query}`;
  },

  async rerun(submissionId, settings, signal) {
    const response = await fetch(`${submissionPath(submissionId)}/rerun`, {
      body: JSON.stringify(settings),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !isSubmissionDetail(body)) {
      throw new Error(readErrorMessage(body, "The model run didn't finish."));
    }

    return body;
  },

  async saveReview(submissionId, review) {
    const response = await fetch(`${submissionPath(submissionId)}/review`, {
      body: JSON.stringify(review),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !isSubmissionDetail(body)) {
      throw new Error(readErrorMessage(body, "The server didn't accept the review."));
    }

    return body;
  },
};
