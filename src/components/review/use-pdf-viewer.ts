"use client";

import { useEffect, useState } from "react";

import { getUrlHost } from "@/lib/submissions/source";

import type {
  InitialPdfViewer,
  PdfViewerResult,
  ReadyPdfViewer,
  ReviewWorkspaceServices,
} from "./review-services";

/** Refresh the signed URL when it has less than this left (addendum G). */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type PdfPaneState =
  | { status: "ready"; viewer: ReadyPdfViewer }
  /** URL source not in the R2 cache yet: POST /pdf/viewer is fetching it. */
  | { host: string | null; status: "caching" }
  /** URL source not cached and nothing has asked for it yet. */
  | { status: "idle" }
  | { message: string; originalUrl: string | null; status: "error" }
  | { status: "unavailable" };

function toPaneState(result: PdfViewerResult): PdfPaneState {
  switch (result.status) {
    case "ready":
      return { status: "ready", viewer: result };
    case "unavailable":
      return { status: "unavailable" };
    case "error":
      return { message: result.message, originalUrl: result.originalUrl, status: "error" };
  }
}

function isExpiringSoon(viewer: ReadyPdfViewer) {
  const expiresAt = Date.parse(viewer.expiresAt);

  return Number.isFinite(expiresAt) && expiresAt - Date.now() < REFRESH_MARGIN_MS;
}

/**
 * The datasheet viewer URL for the pane, the tablet sheet and the Details
 * popover (§5.11, addendum G).
 *
 * - Keeps the FIRST ready URL for the whole page session and ignores later
 *   props (router.refresh() re-signs within the same hour anyway).
 * - An uncached URL source is fetched through POST /pdf/viewer only once the
 *   datasheet is actually shown (`active`), with the "caching" state meanwhile.
 * - `ensureFresh()` re-signs before a page jump when the URL has under 5
 *   minutes left; returning to the tab after expiry re-signs too.
 */
export function usePdfViewer({
  active,
  initial,
  services,
  submissionId,
}: {
  active: boolean;
  initial: InitialPdfViewer;
  services: Pick<ReviewWorkspaceServices, "ensurePdfViewer">;
  submissionId: string;
}) {
  const [initialState] = useState(initial);
  const [result, setResult] = useState<PdfViewerResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const originalUrl =
    initialState.status === "uncached"
      ? initialState.originalUrl
      : initialState.status === "error"
        ? initialState.originalUrl
        : null;
  const needsFetch =
    result === null &&
    (attempt > 0 || (initialState.status === "uncached" && active));

  useEffect(() => {
    if (!needsFetch) {
      return;
    }

    let cancelled = false;

    services.ensurePdfViewer(submissionId).then(
      (next) => {
        if (!cancelled) {
          setResult(next);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setResult({
            message: error instanceof Error ? error.message : "The datasheet couldn't be loaded.",
            originalUrl,
            status: "error",
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt, needsFetch, originalUrl, services, submissionId]);

  let state: PdfPaneState;

  if (result) {
    state = toPaneState(result);
  } else if (needsFetch) {
    state = { host: originalUrl ? getUrlHost(originalUrl) : null, status: "caching" };
  } else {
    switch (initialState.status) {
      case "ready":
        state = { status: "ready", viewer: initialState };
        break;
      case "unavailable":
        state = { status: "unavailable" };
        break;
      case "error":
        state = {
          message: initialState.message,
          originalUrl: initialState.originalUrl,
          status: "error",
        };
        break;
      default:
        state = { status: "idle" };
    }
  }

  const readyViewer = state.status === "ready" ? state.viewer : null;

  function refresh() {
    services.ensurePdfViewer(submissionId).then(
      (next) => {
        if (next.status === "ready") {
          setResult(next);
        }
      },
      () => {
        // Keep the current URL; the next jump tries again.
      },
    );
  }

  useEffect(() => {
    if (!readyViewer) {
      return;
    }

    const viewer = readyViewer;

    function handleVisibility() {
      if (document.visibilityState === "visible" && Date.parse(viewer.expiresAt) <= Date.now()) {
        services.ensurePdfViewer(submissionId).then(
          (next) => {
            if (next.status === "ready") {
              setResult(next);
            }
          },
          () => {},
        );
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [readyViewer, services, submissionId]);

  return {
    originalUrl,
    /** Re-signs the URL when it expires within 5 minutes (call before a jump). */
    ensureFresh() {
      if (readyViewer && isExpiringSoon(readyViewer)) {
        refresh();
      }
    },
    /** Try again after an error. */
    retry() {
      setResult(null);
      setAttempt((current) => current + 1);
    },
    state,
  };
}
