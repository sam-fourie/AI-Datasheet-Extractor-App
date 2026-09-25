import type { PinRow } from "@/lib/package-categories";
import type { ExtractionSnapshot } from "@/lib/submissions/types";

/**
 * Evidence page helpers for the review workspace. Evidence pages are 1-based
 * physical page indexes of the PDF. Everything here is pure.
 */

/** Pins are grouped by evidence page only when there are more than this many. */
export const PIN_GROUP_THRESHOLD = 16;

/** Sorted, de-duplicated, positive integer pages. */
export function normalizeEvidencePages(pages: readonly number[] | null | undefined): number[] {
  if (!pages) {
    return [];
  }

  return Array.from(
    new Set(pages.filter((page) => Number.isInteger(page) && page > 0)),
  ).sort((left, right) => left - right);
}

/** "p. 30" for one page, "pp. 3, 30" for several, null for none. */
export function formatEvidencePages(pages: readonly number[] | null | undefined): string | null {
  const normalized = normalizeEvidencePages(pages);

  if (normalized.length === 0) {
    return null;
  }

  return normalized.length === 1
    ? `p. ${normalized[0]}`
    : `pp. ${normalized.join(", ")}`;
}

/** The page a row opens first: its first listed evidence page. */
export function getPrimaryEvidencePage(pages: readonly number[] | null | undefined): number | null {
  const page = pages?.find((value) => Number.isInteger(value) && value > 0);

  return page ?? null;
}

/**
 * The package row's evidence page: the page cited by the most measurements
 * (each measurement counts a page once). Ties go to the lower page. Null when
 * no measurement has evidence.
 */
export function getPackageEvidencePage(
  extraction: Pick<ExtractionSnapshot, "fields">,
): number | null {
  const citations = new Map<number, number>();

  for (const field of extraction.fields) {
    for (const page of normalizeEvidencePages(field.evidencePages)) {
      citations.set(page, (citations.get(page) ?? 0) + 1);
    }
  }

  let best: { count: number; page: number } | null = null;

  for (const [page, count] of citations) {
    if (!best || count > best.count || (count === best.count && page < best.page)) {
      best = { count, page };
    }
  }

  return best?.page ?? null;
}

export type PinEvidenceGroup = {
  /** Stable key for React lists: "page-13" or "no-evidence". */
  key: string;
  /** The group's page, or null for "No evidence page". */
  page: number | null;
  /** Indexes into the extraction's pinRows, in extraction order. */
  pinIndexes: number[];
};

/**
 * Groups pins by their first evidence page when there are more than 16 pins
 * and at least one pin has an evidence page. Groups are sorted by page, with
 * the "no evidence" group last. Returns null when the list should stay flat.
 */
export function groupPinsByEvidencePage(
  pins: ReadonlyArray<Pick<PinRow, "evidencePages">>,
): PinEvidenceGroup[] | null {
  if (pins.length <= PIN_GROUP_THRESHOLD) {
    return null;
  }

  const byPage = new Map<number | null, number[]>();

  pins.forEach((pin, pinIndex) => {
    const page = getPrimaryEvidencePage(pin.evidencePages);
    const group = byPage.get(page);

    if (group) {
      group.push(pinIndex);
    } else {
      byPage.set(page, [pinIndex]);
    }
  });

  if (!Array.from(byPage.keys()).some((page) => page !== null)) {
    return null;
  }

  return Array.from(byPage, ([page, pinIndexes]) => ({
    key: page === null ? "no-evidence" : `page-${page}`,
    page,
    pinIndexes,
  })).sort((left, right) => {
    if (left.page === null) {
      return 1;
    }

    if (right.page === null) {
      return -1;
    }

    return left.page - right.page;
  });
}

export type PageReference = {
  /** Offset just past the match (exclusive), so text.slice(start, end) === this.text. */
  end: number;
  /** Pages mentioned, sorted and de-duplicated. */
  pages: number[];
  /** Offset of the first character of the match. */
  start: number;
  /** The matched text, e.g. "pages 12 and 14". */
  text: string;
};

/** Ranges wider than this keep only their end points. */
const MAX_EXPANDED_RANGE = 50;

const PAGE_NUMBER = String.raw`\d{1,4}`;
const PAGE_RANGE = String.raw`${PAGE_NUMBER}(?:\s*(?:-|–|—|to)\s*${PAGE_NUMBER})?`;
const PAGE_LIST_SEPARATOR = String.raw`\s*(?:,\s*(?:and|&)?|and|&|or)\s*`;
const PAGE_REFERENCE_PATTERN = new RegExp(
  String.raw`\b(?:pages?|pgs?\.?|pp?\.)\s*(${PAGE_RANGE}(?:${PAGE_LIST_SEPARATOR}${PAGE_RANGE})*)(?![\d.,]*\d)`,
  "gi",
);

function expandPages(list: string): number[] {
  const pages: number[] = [];

  for (const part of list.split(/\s*(?:,|and|&|or)\s*/i)) {
    const range = part.match(/^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i);

    if (range) {
      const from = Number.parseInt(range[1], 10);
      const to = Number.parseInt(range[2], 10);
      const low = Math.min(from, to);
      const high = Math.max(from, to);

      if (high - low > MAX_EXPANDED_RANGE) {
        pages.push(low, high);
      } else {
        for (let page = low; page <= high; page += 1) {
          pages.push(page);
        }
      }

      continue;
    }

    const single = part.match(/^(\d+)$/);

    if (single) {
      pages.push(Number.parseInt(single[1], 10));
    }
  }

  return normalizeEvidencePages(pages);
}

/**
 * Finds page mentions in AI review notes ("page 12", "pages 12 and 14",
 * "p. 3", "pp. 3-5") so they can be rendered as evidence chips.
 */
export function extractPageReferences(text: string): PageReference[] {
  const references: PageReference[] = [];

  for (const match of text.matchAll(PAGE_REFERENCE_PATTERN)) {
    const pages = expandPages(match[1]);

    if (pages.length === 0 || match.index === undefined) {
      continue;
    }

    references.push({
      end: match.index + match[0].length,
      pages,
      start: match.index,
      text: match[0],
    });
  }

  return references;
}
