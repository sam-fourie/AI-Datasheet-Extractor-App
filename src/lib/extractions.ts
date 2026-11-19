import type { OpenAIModelId, OpenAIReasoningEffort } from "@/lib/ai/models";
import type { PackageCategory } from "@/lib/package-categories";

export type UploadedPdfPayload = {
  fileName: string;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
};

/**
 * The optional package drawing (a second PDF with the package outline), for
 * datasheets that refer to a separate drawing. Uploaded the same way as the
 * datasheet (POST /api/extractions/upload-url, then a PUT), or a link.
 */
export type DrawingPayload =
  | { kind: "upload"; uploadedPdf: UploadedPdfPayload }
  | { kind: "url"; url: string };

export type ExtractionUploadRequest = {
  drawing?: DrawingPayload;
  model?: OpenAIModelId;
  packageCategory: PackageCategory;
  partNumber: string;
  reasoningEffort?: OpenAIReasoningEffort;
  sourceMode: "upload";
  uploadedPdf: UploadedPdfPayload;
};

export type ExtractionUrlRequest = {
  datasheetUrl: string;
  drawing?: DrawingPayload;
  model?: OpenAIModelId;
  packageCategory: PackageCategory;
  partNumber: string;
  reasoningEffort?: OpenAIReasoningEffort;
  sourceMode: "url";
};

export type ExtractionRequestPayload =
  | ExtractionUploadRequest
  | ExtractionUrlRequest;

export type UploadUrlRequestPayload = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type UploadUrlResponse = {
  expiresAt: string;
  objectKey: string;
  requiredHeaders: {
    "content-type": string;
  };
  uploadUrl: string;
};

export type RerunRequestPayload = {
  /** A drawing for this run. Without one, the run keeps the drawing of the submission it was started from. */
  drawing?: DrawingPayload;
  model?: OpenAIModelId;
  reasoningEffort?: OpenAIReasoningEffort;
};

/** Machine-readable failure reason returned by POST /api/extractions (spec §2.2). */
export type ExtractionErrorCode =
  | "upload-failed"
  | "source-unreachable"
  | "invalid-pdf"
  | "too-large"
  | "timeout"
  | "not-configured"
  | "invalid-request"
  | "cancelled"
  | "unknown";

export type ExtractionErrorResponse = {
  code: ExtractionErrorCode;
  /** Raw server message; show it behind a "Details" disclosure. */
  error: string;
  /**
   * True when the pending upload object was kept after a model-side failure
   * (timeout, provider error), so "Try again" can resend the same
   * `uploadedPdf` payload without re-uploading the file (addendum T).
   */
  retryableUpload?: boolean;
};

/** Machine-readable failure reason returned by POST /api/pdf-url-validation. */
export type PdfUrlValidationErrorCode = Extract<
  ExtractionErrorCode,
  "invalid-pdf" | "invalid-request" | "source-unreachable" | "too-large" | "unknown"
>;

export type PdfUrlValidationResponse =
  | {
      fileName: string;
      /** URL host without "www.", e.g. "ti.com". */
      host: string;
      ok: true;
      sizeBytes: number;
    }
  | {
      code: PdfUrlValidationErrorCode;
      error: string;
      ok?: false;
    };
