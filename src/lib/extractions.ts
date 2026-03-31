import type { PackageCategory } from "@/lib/package-categories";

export type UploadedPdfPayload = {
  fileName: string;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
};

export type ExtractionUploadRequest = {
  packageCategory: PackageCategory;
  partNumber: string;
  sourceMode: "upload";
  uploadedPdf: UploadedPdfPayload;
};

export type ExtractionUrlRequest = {
  datasheetUrl: string;
  packageCategory: PackageCategory;
  partNumber: string;
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
