import type { SubmissionSourceMeta } from "@/lib/submissions/types";

export function hasRetainedUploadSource(
  sourceMeta: SubmissionSourceMeta,
): sourceMeta is Extract<SubmissionSourceMeta, { kind: "upload" }> & {
  objectKey: string;
  storageProvider: "cloudflare-r2";
} {
  return (
    sourceMeta.kind === "upload" &&
    sourceMeta.storageProvider === "cloudflare-r2" &&
    typeof sourceMeta.objectKey === "string" &&
    sourceMeta.objectKey.length > 0
  );
}

export function getSubmissionPdfPath(
  submissionId: string,
  sourceMeta: SubmissionSourceMeta,
) {
  if (!hasRetainedUploadSource(sourceMeta)) {
    return null;
  }

  return `/api/submissions/${submissionId}/pdf`;
}
