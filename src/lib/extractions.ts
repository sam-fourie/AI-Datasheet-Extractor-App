import type { OpenAIModelId, OpenAIReasoningEffort } from "@/lib/ai/models";
import type { PackageCategory } from "@/lib/package-categories";

export type UploadedPdfPayload = {
  fileName: string;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
};

export type ExtractionUploadRequest = {
  model?: OpenAIModelId;
  packageCategory: PackageCategory;
  partNumber: string;
  reasoningEffort?: OpenAIReasoningEffort;
  sourceMode: "upload";
  uploadedPdf: UploadedPdfPayload;
};

export type ExtractionUrlRequest = {
  datasheetUrl: string;
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
