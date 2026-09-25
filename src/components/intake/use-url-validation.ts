"use client";

import { useEffect, useState } from "react";

import type {
  PdfUrlValidationErrorCode,
  PdfUrlValidationResponse,
} from "@/lib/extractions";

import { isAbsoluteHttpUrl } from "./intake-helpers";

export type UrlValidation =
  | { status: "idle" }
  | { status: "malformed"; url: string }
  | { status: "checking"; url: string }
  | {
      fileName: string;
      host: string;
      sizeBytes: number;
      status: "valid";
      url: string;
    }
  | {
      code: PdfUrlValidationErrorCode;
      message: string;
      status: "invalid";
      url: string;
    };

const DEBOUNCE_MS = 500;

type ValidationResult = Exclude<UrlValidation, { status: "idle" | "malformed" | "checking" }>;

/**
 * Debounced POST /api/pdf-url-validation for the link input. The route
 * downloads the PDF server-side, so a stale request is aborted as soon as the
 * link changes. The returned state always describes the current link.
 */
export function useUrlValidation(rawUrl: string): UrlValidation {
  const url = rawUrl.trim();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const isWellFormed = url.length > 0 && isAbsoluteHttpUrl(url);

  useEffect(() => {
    if (!isWellFormed) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pdf-url-validation", {
          body: JSON.stringify({ datasheetUrl: url }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | PdfUrlValidationResponse
          | null;

        if (controller.signal.aborted) {
          return;
        }

        if (response.ok && payload && payload.ok === true) {
          setResult({
            fileName: payload.fileName,
            host: payload.host,
            sizeBytes: payload.sizeBytes,
            status: "valid",
            url,
          });
          return;
        }

        setResult({
          code: payload && "code" in payload ? payload.code : "unknown",
          message:
            (payload && "error" in payload && payload.error) ||
            "We couldn't download that PDF.",
          status: "invalid",
          url,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setResult({
          code: "unknown",
          message: "We couldn't check that link. Check your connection.",
          status: "invalid",
          url,
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isWellFormed, url]);

  if (url.length === 0) {
    return { status: "idle" };
  }

  if (!isWellFormed) {
    return { status: "malformed", url };
  }

  if (result && result.url === url) {
    return result;
  }

  return { status: "checking", url };
}
