import { describe, expect, it } from "vitest";

import { validateDrawingInput } from "@/lib/drawing-upload";

describe("validateDrawingInput", () => {
  it("accepts a PDF file and an http link", () => {
    expect(validateDrawingInput({ file: new File(["%PDF"], "outline.pdf", { type: "application/pdf" }), kind: "upload" })).toBeNull();
    expect(validateDrawingInput({ kind: "url", url: "https://example.com/outline.pdf" })).toBeNull();
  });

  it("explains what's wrong", () => {
    expect(validateDrawingInput({ file: new File(["x"], "outline.png", { type: "image/png" }), kind: "upload" })).toBe(
      "The drawing must be a PDF.",
    );
    expect(validateDrawingInput({ kind: "url", url: "example.com/outline.pdf" })).toBe("Enter the full link to the drawing PDF.");
    expect(validateDrawingInput({ kind: "url", url: "ftp://example.com/outline.pdf" })).toBe(
      "Enter a link that starts with http or https.",
    );
  });
});
