import { describe, expect, it } from "vitest";

import { DrawingSourceError, parseDrawingPayload } from "@/lib/drawing-source";

const upload = {
  fileName: "21-100765.pdf",
  mimeType: "application/pdf",
  objectKey: "datasheets/pending/1234/21-100765.pdf",
  sizeBytes: 120_000,
};

describe("parseDrawingPayload", () => {
  it("is optional", () => {
    expect(parseDrawingPayload(undefined)).toBeNull();
    expect(parseDrawingPayload(null)).toBeNull();
  });

  it("reads an upload and a link", () => {
    expect(parseDrawingPayload({ kind: "upload", uploadedPdf: upload })).toEqual({ kind: "upload", uploadedPdf: upload });
    expect(parseDrawingPayload({ kind: "url", url: " https://www.analog.com/21-100765.pdf " })).toEqual({
      kind: "url",
      url: "https://www.analog.com/21-100765.pdf",
    });
  });

  it.each([
    [{ kind: "url", url: "ftp://example.com/a.pdf" }, "invalid-request"],
    [{ kind: "url", url: "not a link" }, "invalid-request"],
    [{ kind: "upload", uploadedPdf: { ...upload, mimeType: "image/png" } }, "invalid-pdf"],
    [{ kind: "upload", uploadedPdf: { ...upload, sizeBytes: 999_999_999 } }, "too-large"],
    [{ kind: "upload", uploadedPdf: { ...upload, objectKey: "datasheets/submissions/x/a.pdf" } }, "upload-failed"],
    [{ kind: "file" }, "invalid-request"],
    ["drawing.pdf", "invalid-request"],
  ])("rejects %j", (value, code) => {
    try {
      parseDrawingPayload(value);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DrawingSourceError);
      expect((error as DrawingSourceError).code).toBe(code);
      expect((error as DrawingSourceError).message).toMatch(/^Package drawing:/);
    }
  });
});
