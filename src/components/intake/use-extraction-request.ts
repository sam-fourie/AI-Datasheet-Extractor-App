"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  useNavigationGuard,
  useNavigationGuardControls,
} from "@/components/navigation-blocker-provider";
import { useToast } from "@/components/ui";
import type {
  ExtractionErrorCode,
  ExtractionErrorResponse,
  ExtractionRequestPayload,
  UploadedPdfPayload,
  UploadUrlRequestPayload,
  UploadUrlResponse,
} from "@/lib/extractions";
import { PDF_MIME_TYPE } from "@/lib/pdf";
import type { SubmissionDetail } from "@/lib/submissions/types";

import {
  getFileIdentity,
  REVIEW_ARRIVAL_KEY_PREFIX,
  type ExtractionFailure,
  type ExtractionRequestInput,
} from "./intake-helpers";

/**
 * Request state machine for a new extraction (spec §2.2, addenda A, E, T):
 *
 *   idle -> uploading -> extracting -> opening
 *                    \-> error | cancelled (the form is restored)
 *
 * The R2 PUT goes through XMLHttpRequest for byte progress; the extraction
 * POST uses fetch. One AbortController covers both. While uploading or
 * extracting a navigation-level guard asks before leaving, and Leave aborts.
 */

export type ExtractionPhase =
  | "idle"
  | "uploading"
  | "extracting"
  | "opening"
  | "error"
  | "cancelled";

export type UploadProgress = { loaded: number; total: number };

export type ExtractionRequestState = {
  error: ExtractionFailure | null;
  /** Client-measured duration of the extraction call, once it returned. */
  extractDurationMs: number | null;
  extractStartedAt: number | null;
  input: ExtractionRequestInput | null;
  phase: ExtractionPhase;
  upload: UploadProgress | null;
  /** True when a kept upload was reused instead of uploading again. */
  uploadReused: boolean;
};

const INITIAL_STATE: ExtractionRequestState = {
  error: null,
  extractDurationMs: null,
  extractStartedAt: null,
  input: null,
  phase: "idle",
  upload: null,
  uploadReused: false,
};

const CANCELLED_STATUS = 499;
const CANCEL_DESCRIPTION =
  "We'll stop the extraction. If it had already finished, it will still appear in Submissions.";

const KNOWN_CODES: readonly ExtractionErrorCode[] = [
  "upload-failed",
  "source-unreachable",
  "invalid-pdf",
  "too-large",
  "timeout",
  "not-configured",
  "invalid-request",
  "cancelled",
  "unknown",
];

/** Codes POST /api/extractions/upload-url returns with its `error`. */
const UPLOAD_URL_CODES = [
  "invalid-request",
  "not-configured",
  "too-large",
  "upload-failed",
] as const satisfies readonly ExtractionErrorCode[];

type UploadUrlErrorCode = (typeof UPLOAD_URL_CODES)[number];

class RequestFailure extends Error {
  constructor(readonly failure: ExtractionFailure) {
    super(failure.message);
    this.name = "RequestFailure";
  }
}

class CancelledError extends Error {
  constructor() {
    super("Extraction cancelled.");
    this.name = "CancelledError";
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof CancelledError ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function toCode(value: unknown): ExtractionErrorCode {
  return typeof value === "string" &&
    (KNOWN_CODES as readonly string[]).includes(value)
    ? (value as ExtractionErrorCode)
    : "unknown";
}

async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function putWithProgress(
  upload: UploadUrlResponse,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: UploadProgress) => void,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new CancelledError());
      return;
    }

    const xhr = new XMLHttpRequest();
    const handleAbort = () => xhr.abort();

    xhr.open("PUT", upload.uploadUrl);

    for (const [name, value] of Object.entries(upload.requiredHeaders)) {
      xhr.setRequestHeader(name, value);
    }

    xhr.upload.onprogress = (event) => {
      onProgress({
        loaded: event.loaded,
        total: event.lengthComputable && event.total > 0 ? event.total : file.size,
      });
    };
    xhr.onload = () => {
      signal.removeEventListener("abort", handleAbort);

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, total: file.size });
        resolve();
      } else {
        reject(
          new RequestFailure({
            code: "upload-failed",
            message: `Storage rejected the upload (HTTP ${xhr.status}).`,
          }),
        );
      }
    };
    xhr.onerror = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(
        new RequestFailure({
          code: "upload-failed",
          message:
            "Could not reach the storage endpoint. Check the connection and the bucket's CORS configuration.",
        }),
      );
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(new CancelledError());
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    xhr.send(file);
  });
}

async function requestUploadUrl(file: File, signal: AbortSignal) {
  let response: Response;

  try {
    response = await fetch("/api/extractions/upload-url", {
      body: JSON.stringify({
        fileName: file.name,
        mimeType: PDF_MIME_TYPE,
        sizeBytes: file.size,
      } satisfies UploadUrlRequestPayload),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      throw new CancelledError();
    }

    throw new RequestFailure({
      code: "upload-failed",
      message: "Could not reach the server to prepare the upload.",
    });
  }

  const payload = await readJson<UploadUrlResponse | Partial<ExtractionErrorResponse>>(
    response,
  );

  if (!response.ok || !payload || !("uploadUrl" in payload)) {
    const failure = payload && !("uploadUrl" in payload) ? payload : null;
    const code = toCode(failure?.code);

    throw new RequestFailure({
      // The route always sends one of these codes; anything else (a proxy
      // error page, a malformed body) is still an upload preparation failure.
      code: (UPLOAD_URL_CODES as readonly string[]).includes(code)
        ? (code as UploadUrlErrorCode)
        : "upload-failed",
      message: failure?.error || "Could not prepare the PDF upload.",
    });
  }

  return payload;
}

type KeptUpload = { identity: string; payload: UploadedPdfPayload };

export function useExtractionRequest() {
  const [state, setState] = useState<ExtractionRequestState>(INITIAL_STATE);
  const toast = useToast();
  const { releaseAndReplace } = useNavigationGuardControls();
  const controllerRef = useRef<AbortController | null>(null);
  const keptUploadRef = useRef<KeptUpload | null>(null);
  const runIdRef = useRef(0);

  const isInFlight = state.phase === "uploading" || state.phase === "extracting";

  const abortCurrent = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useNavigationGuard(
    isInFlight
      ? {
          description: CANCEL_DESCRIPTION,
          leaveLabel: "Cancel extraction",
          level: "navigation",
          onLeave: abortCurrent,
          title: "Leave and cancel the extraction?",
        }
      : null,
  );

  // Leaving the page by any route (the guard's Leave, a hard unload) stops the request.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const showCancelledToast = useCallback(() => {
    toast.show({
      description: "If it had already finished, it will still appear in Submissions.",
      id: "extraction-cancelled",
      title: "Extraction cancelled",
    });
  }, [toast]);

  const start = useCallback(
    async (input: ExtractionRequestInput) => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      const runId = runIdRef.current + 1;
      const signal = controller.signal;
      const isCurrent = () => runIdRef.current === runId;

      runIdRef.current = runId;
      controllerRef.current = controller;

      const { source } = input;
      const fileIdentity = source.kind === "upload" ? getFileIdentity(source.file) : null;
      const kept =
        fileIdentity && keptUploadRef.current?.identity === fileIdentity
          ? keptUploadRef.current
          : null;

      setState({
        ...INITIAL_STATE,
        input,
        phase: source.kind === "upload" && !kept ? "uploading" : "extracting",
        extractStartedAt: source.kind === "upload" && !kept ? null : Date.now(),
        upload:
          source.kind === "upload"
            ? {
                loaded: kept ? source.file.size : 0,
                total: source.file.size,
              }
            : null,
        uploadReused: Boolean(kept),
      });

      let usedPayload: UploadedPdfPayload | null = kept?.payload ?? null;

      try {
        let body: ExtractionRequestPayload;

        if (source.kind === "upload") {
          if (!usedPayload) {
            const upload = await requestUploadUrl(source.file, signal);

            await putWithProgress(upload, source.file, signal, (progress) => {
              if (isCurrent()) {
                setState((current) => ({ ...current, upload: progress }));
              }
            });

            usedPayload = {
              fileName: source.file.name,
              mimeType: PDF_MIME_TYPE,
              objectKey: upload.objectKey,
              sizeBytes: source.file.size,
            };

            if (!isCurrent()) {
              return;
            }

            setState((current) => ({
              ...current,
              extractStartedAt: Date.now(),
              phase: "extracting",
            }));
          }

          body = {
            model: input.model,
            packageCategory: input.packageCategory,
            partNumber: input.partNumber,
            reasoningEffort: input.reasoningEffort,
            sourceMode: "upload",
            uploadedPdf: usedPayload,
          };
        } else {
          body = {
            datasheetUrl: source.url,
            model: input.model,
            packageCategory: input.packageCategory,
            partNumber: input.partNumber,
            reasoningEffort: input.reasoningEffort,
            sourceMode: "url",
          };
        }

        const extractStartedAt = Date.now();
        let response: Response;

        try {
          response = await fetch("/api/extractions", {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
            method: "POST",
            signal,
          });
        } catch (error) {
          if (isAbortError(error) || signal.aborted) {
            throw new CancelledError();
          }

          throw new RequestFailure({
            code: "unknown",
            message:
              "The connection to the server was lost. If the extraction finished, it will appear in Submissions.",
          });
        }

        const payload = await readJson<SubmissionDetail | ExtractionErrorResponse>(response);

        if (!isCurrent()) {
          return;
        }

        if (response.status === CANCELLED_STATUS || (payload && "code" in payload && payload.code === "cancelled")) {
          throw new CancelledError();
        }

        if (!response.ok || !payload || !("submissionId" in payload)) {
          const errorBody = payload && "code" in payload ? payload : null;
          const code = toCode(errorBody?.code);

          if (errorBody?.retryableUpload && fileIdentity && usedPayload) {
            keptUploadRef.current = { identity: fileIdentity, payload: usedPayload };
          } else if (kept || code === "upload-failed") {
            keptUploadRef.current = null;
          }

          throw new RequestFailure({
            code: code === "cancelled" ? "unknown" : code,
            message:
              errorBody?.error ||
              `The server responded with HTTP ${response.status}.`,
          });
        }

        keptUploadRef.current = null;

        const submissionId = payload.submissionId;

        try {
          window.sessionStorage.setItem(`${REVIEW_ARRIVAL_KEY_PREFIX}${submissionId}`, "1");
        } catch {
          // Storage can be unavailable (private mode); the review page then skips the banner.
        }

        // Release while the guard is still registered, then drop it (addendum A, D).
        releaseAndReplace(`/submissions/${submissionId}`);
        setState((current) => ({
          ...current,
          extractDurationMs: Date.now() - (current.extractStartedAt ?? extractStartedAt),
          phase: "opening",
        }));
      } catch (error) {
        if (!isCurrent()) {
          return;
        }

        controllerRef.current = null;

        if (isAbortError(error) || signal.aborted) {
          setState((current) => ({ ...current, error: null, phase: "cancelled" }));
          showCancelledToast();
          return;
        }

        const failure: ExtractionFailure =
          error instanceof RequestFailure
            ? error.failure
            : {
                code: "unknown",
                message: error instanceof Error ? error.message : String(error),
              };

        setState((current) => ({ ...current, error: failure, phase: "error" }));
      }
    },
    [releaseAndReplace, showCancelledToast],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clearError = useCallback(() => {
    setState((current) =>
      current.phase === "error" ? { ...current, error: null, phase: "idle" } : current,
    );
  }, []);

  return { cancel, clearError, start, state };
}
