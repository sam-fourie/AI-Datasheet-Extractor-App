import { describe, expect, it } from "vitest";

import {
  extractPageReferences,
  formatEvidencePages,
  getPackageEvidencePage,
  getPrimaryEvidencePage,
  groupPinsByEvidencePage,
} from "@/lib/submissions/evidence";

describe("formatEvidencePages", () => {
  it("formats one or several pages", () => {
    expect(formatEvidencePages([30])).toBe("p. 30");
    expect(formatEvidencePages([30, 3])).toBe("pp. 3, 30");
    expect(formatEvidencePages([3, 3, 30])).toBe("pp. 3, 30");
  });

  it("returns null without valid pages", () => {
    expect(formatEvidencePages(undefined)).toBeNull();
    expect(formatEvidencePages([])).toBeNull();
    expect(formatEvidencePages([0, -1, 2.5])).toBeNull();
  });

  it("uses the first listed page as the primary page", () => {
    expect(getPrimaryEvidencePage([30, 3])).toBe(30);
    expect(getPrimaryEvidencePage([])).toBeNull();
  });
});

describe("getPackageEvidencePage", () => {
  it("returns the page cited by the most measurements", () => {
    expect(
      getPackageEvidencePage({
        fields: [
          { evidencePages: [3, 30], field: "A", status: "Extracted", value: "1" },
          { evidencePages: [30], field: "B", status: "Extracted", value: "1" },
          { evidencePages: [3, 3], field: "C", status: "Extracted", value: "1" },
          { evidencePages: [31], field: "D", status: "Extracted", value: "1" },
        ],
      }),
    ).toBe(3);
  });

  it("breaks ties with the lower page and returns null without evidence", () => {
    expect(
      getPackageEvidencePage({
        fields: [
          { evidencePages: [30], field: "A", status: "Extracted", value: "1" },
          { evidencePages: [12], field: "B", status: "Extracted", value: "1" },
        ],
      }),
    ).toBe(12);
    expect(
      getPackageEvidencePage({ fields: [{ field: "A", status: "Extracted", value: "1" }] }),
    ).toBeNull();
  });
});

describe("groupPinsByEvidencePage", () => {
  const pins = (count: number, pageFor: (index: number) => number[] | undefined) =>
    Array.from({ length: count }, (_, index) => ({ evidencePages: pageFor(index) }));

  it("keeps 16 or fewer pins flat", () => {
    expect(groupPinsByEvidencePage(pins(16, () => [3]))).toBeNull();
  });

  it("keeps the list flat when no pin has an evidence page", () => {
    expect(groupPinsByEvidencePage(pins(20, () => undefined))).toBeNull();
  });

  it("groups by first evidence page, sorted, with no evidence last", () => {
    const groups = groupPinsByEvidencePage(
      pins(20, (index) =>
        index < 5 ? [14, 13] : index < 10 ? undefined : index < 15 ? [13] : [2],
      ),
    );

    expect(groups?.map((group) => group.page)).toEqual([2, 13, 14, null]);
    expect(groups?.map((group) => group.key)).toEqual([
      "page-2",
      "page-13",
      "page-14",
      "no-evidence",
    ]);
    expect(groups?.[1].pinIndexes).toEqual([10, 11, 12, 13, 14]);
    expect(groups?.[2].pinIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(groups?.[3].pinIndexes).toEqual([5, 6, 7, 8, 9]);
  });
});

describe("extractPageReferences", () => {
  it("finds single pages", () => {
    const references = extractPageReferences("Dimensions are on page 12 of the PDF.");

    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ pages: [12], text: "page 12" });
    expect("Dimensions are on page 12 of the PDF.".slice(references[0].start, references[0].end)).toBe(
      "page 12",
    );
  });

  it("finds lists, abbreviations and ranges", () => {
    expect(extractPageReferences("See pages 12 and 14.")[0].pages).toEqual([12, 14]);
    expect(extractPageReferences("See pages 3, 5 and 9")[0].pages).toEqual([3, 5, 9]);
    expect(extractPageReferences("Drawing on p. 3")[0].pages).toEqual([3]);
    expect(extractPageReferences("Tables on pp. 3-5")[0].pages).toEqual([3, 4, 5]);
    expect(extractPageReferences("Tables on pp. 3–5")[0].pages).toEqual([3, 4, 5]);
    expect(extractPageReferences("Page 30 and page 31")).toHaveLength(2);
  });

  it("keeps only the end points of very wide ranges", () => {
    expect(extractPageReferences("pages 1-400")[0].pages).toEqual([1, 400]);
  });

  it("ignores text without page mentions", () => {
    expect(extractPageReferences("Pin 3 is TRIG; step 4 of the pipeline.")).toEqual([]);
    expect(extractPageReferences("The package is 8-pin SOIC")).toEqual([]);
  });
});
