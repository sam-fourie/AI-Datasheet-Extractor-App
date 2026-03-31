export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const PDF_MIME_TYPE = "application/pdf";

const PDF_SIGNATURE_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

function sanitizeFileNameSegment(value: string) {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");

  return sanitized.length > 0 ? sanitized : "datasheet";
}

export function buildPdfDisplayFileName(fileName: string | null | undefined) {
  const lastSegment =
    typeof fileName === "string"
      ? fileName
          .trim()
          .split(/[\\/]/)
          .filter(Boolean)
          .at(-1)
      : undefined;

  return lastSegment && lastSegment.length > 0 ? lastSegment : "datasheet.pdf";
}

export function normalizePdfFileName(fileName: string | null | undefined) {
  const displayName = buildPdfDisplayFileName(fileName);
  const baseName = displayName.replace(/\.pdf$/i, "");

  return `${sanitizeFileNameSegment(baseName)}.pdf`;
}

export function buildPdfFileNameFromUrl(url: URL) {
  const lastPathSegment = url.pathname.split("/").filter(Boolean).at(-1);

  return normalizePdfFileName(lastPathSegment);
}

export function isPdfMimeType(value: string | null | undefined) {
  return value === PDF_MIME_TYPE;
}

export function looksLikePdf(bytes: Uint8Array) {
  return (
    bytes.byteLength >= PDF_SIGNATURE_BYTES.length &&
    PDF_SIGNATURE_BYTES.every((byte, index) => bytes[index] === byte)
  );
}
