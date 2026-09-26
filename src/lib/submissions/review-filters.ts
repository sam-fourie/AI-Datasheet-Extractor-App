/**
 * Row filtering rules for the review workspace: which rows a filter, the pin
 * search and sticky keys leave visible, and in what order. Pure and
 * client-safe. Attention itself comes from classifyRowAttention in review.ts.
 */

import type { PinRow } from "@/lib/package-categories";
import {
  classifyRowAttention,
  getRowDecision,
  listReviewRowRefs,
  rowKeyOf,
  type AttentionContext,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import type {
  BaselineRunHints,
  ExtractionSnapshot,
  SubmissionAgreementRow,
  SubmissionHumanReview,
} from "@/lib/submissions/types";

/**
 * Filter menu values (§4.3, §5.6, addendum J). "differs" is offered on re-run
 * pages, "runsDisagree" on baselines that have runs.
 */
export type ReviewFilter =
  | "all"
  | "pending"
  | "attention"
  | "incorrect"
  | "differs"
  | "runsDisagree";

/**
 * Builds the per-row attention context (agreement outcome on re-runs, run
 * hints on baselines) for classifyRowAttention / planBulkConfirm.
 * `comparison.agreementByKey` is keyed by the re-run's own row key
 * (indexAgreementRowsByRerunKey).
 */
export function createAttentionContextResolver(input: {
  comparison?: { agreementByKey: ReadonlyMap<string, SubmissionAgreementRow> } | null;
  runHints?: BaselineRunHints | null;
}): (ref: ReviewRowRef) => AttentionContext {
  const { comparison, runHints } = input;

  return (ref) => ({
    agreementOutcome: comparison?.agreementByKey.get(rowKeyOf(ref))?.outcome ?? null,
    runHints: runHints ?? null,
  });
}

export type FilteredSection = "package" | "measurements" | "pins";

const FILTERED_OUT_COPY: Record<Exclude<ReviewFilter, "all">, Record<FilteredSection, string>> = {
  attention: {
    measurements: "No measurements need attention.",
    package: "The package doesn't need attention.",
    pins: "No pins need attention.",
  },
  differs: {
    measurements: "No measurements differ from the baseline.",
    package: "The package doesn't differ from the baseline.",
    pins: "No pins differ from the baseline.",
  },
  incorrect: {
    measurements: "No measurements are marked incorrect.",
    package: "The package isn't marked incorrect.",
    pins: "No pins are marked incorrect.",
  },
  pending: {
    measurements: "Every measurement is decided.",
    package: "The package is decided.",
    pins: "Every pin is decided.",
  },
  runsDisagree: {
    measurements: "Most runs agree on every measurement.",
    package: "Most runs agree on the package.",
    pins: "Most runs agree on every pin.",
  },
};

/**
 * Copy for a section whose rows the active filter hides entirely. It says what
 * the filter found ("No pins differ from the baseline") so an emptied section
 * never reads as missing data.
 */
export function describeFilteredOutSection(
  filter: ReviewFilter,
  section: FilteredSection,
): string {
  if (filter === "all") {
    return section === "package"
      ? "The package doesn't match this filter."
      : `No ${section} match this filter.`;
  }

  return FILTERED_OUT_COPY[filter][section];
}

/** Whether a row passes a filter. Attention comes from classifyRowAttention. */
export function matchesReviewFilter(
  filter: ReviewFilter,
  extraction: ExtractionSnapshot,
  review: SubmissionHumanReview,
  ref: ReviewRowRef,
  context?: AttentionContext | null,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return getRowDecision(review, ref) === "pending";
    case "incorrect":
      return getRowDecision(review, ref) === "corrected";
    case "attention":
      return classifyRowAttention(extraction, ref, context).length > 0;
    case "differs": {
      const outcome = context?.agreementOutcome;

      return outcome === "mismatch" || outcome === "partial";
    }
    case "runsDisagree":
      return classifyRowAttention(extraction, ref, context).includes("runsDisagree");
  }
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Pin search ("Find pin"): an exact pin number, or a substring of the pin
 * name (or number plus name), ignoring case and punctuation. An empty query
 * matches every pin.
 */
export function pinMatchesQuery(pin: Pick<PinRow, "pinName" | "pinNumber">, query: string) {
  const needle = normalizeSearchText(query);

  if (!needle) {
    return true;
  }

  return (
    normalizeSearchText(pin.pinNumber) === needle ||
    normalizeSearchText(pin.pinName).includes(needle) ||
    normalizeSearchText(`${pin.pinNumber}${pin.pinName}`).includes(needle)
  );
}

export type VisibleRows = {
  /** Visible rows in display order (J/K, N, bulk scopes). Sticky rows included. */
  order: ReviewRowRef[];
  /** Keys of `order`, for RowVisibility.isVisible. */
  keys: ReadonlySet<string>;
};

/**
 * Display order of the rows visible under the filter and pin search, plus
 * sticky rows (decided while the filter excludes them; they stay until the
 * filter changes). Package first, then measurements, then pins. Pin order
 * follows the grouped display order when the list is grouped (pass `pinOrder`
 * from groupPinsByEvidencePage), else extraction order.
 */
export function computeVisibleRows(input: {
  contextFor?: (ref: ReviewRowRef) => AttentionContext | null | undefined;
  extraction: ExtractionSnapshot;
  filter: ReviewFilter;
  pinOrder?: readonly number[] | null;
  pinQuery?: string;
  review: SubmissionHumanReview;
  stickyKeys?: ReadonlySet<string>;
}): VisibleRows {
  const { contextFor, extraction, filter, pinOrder, pinQuery = "", review, stickyKeys } = input;
  const refs = listReviewRowRefs(extraction);
  const pinRefs = pinOrder
    ? pinOrder.map((pinIndex) => ({ kind: "pin" as const, pinIndex }))
    : refs.filter((ref) => ref.kind === "pin");
  const ordered = [...refs.filter((ref) => ref.kind !== "pin"), ...pinRefs];
  const order: ReviewRowRef[] = [];
  const keys = new Set<string>();

  for (const ref of ordered) {
    const key = rowKeyOf(ref);
    const sticky = stickyKeys?.has(key) ?? false;
    const matchesSearch =
      ref.kind !== "pin" ||
      pinMatchesQuery(extraction.pinRows[ref.pinIndex] ?? { pinName: "", pinNumber: "" }, pinQuery);
    const matchesFilter = matchesReviewFilter(filter, extraction, review, ref, contextFor?.(ref));

    if (sticky || (matchesSearch && matchesFilter)) {
      order.push(ref);
      keys.add(key);
    }
  }

  return { keys, order };
}
