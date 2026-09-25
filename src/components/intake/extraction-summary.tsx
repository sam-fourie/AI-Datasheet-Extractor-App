"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/components/ui";
import { PACKAGE_CATEGORY_FIELDS, type PackageCategory } from "@/lib/package-categories";

export type ExtractionSummaryProps = {
  category: PackageCategory;
};

const MAX_LINES = 2;
const CHIP_CLASS_NAME =
  "inline-flex h-6 items-center rounded-xs bg-surface-muted px-2 text-caption whitespace-nowrap text-text-muted";
const MORE_CLASS_NAME =
  "inline-flex h-6 items-center rounded-xs px-2 text-caption font-medium whitespace-nowrap text-accent-text hover:bg-surface-hover pointer-coarse:min-h-11";

/**
 * How many chips fit in two lines, leaving room for the "+N more" button on
 * the last line. Measured from an invisible copy of every chip.
 */
function countVisibleChips(measure: HTMLElement) {
  const chips = Array.from(measure.querySelectorAll<HTMLElement>("[data-chip]"));
  const more = measure.querySelector<HTMLElement>("[data-more]");

  if (chips.length === 0) {
    return 0;
  }

  const lineTops = Array.from(new Set(chips.map((chip) => chip.offsetTop))).sort(
    (left, right) => left - right,
  );

  if (lineTops.length <= MAX_LINES) {
    return chips.length;
  }

  const lastLineTop = lineTops[MAX_LINES - 1];
  const width = measure.clientWidth;
  const gap = 6;
  const moreWidth = (more?.offsetWidth ?? 72) + gap;
  let lastIndex = 0;

  chips.forEach((chip, index) => {
    if (chip.offsetTop === lastLineTop) {
      lastIndex = index;
    }
  });

  while (
    lastIndex > 0 &&
    chips[lastIndex].offsetLeft + chips[lastIndex].offsetWidth + moreWidth > width
  ) {
    lastIndex -= 1;
  }

  return Math.max(1, lastIndex + 1);
}

/**
 * "We'll extract 10 measurements, the pin map and the package variant." plus
 * the field chips, capped at two lines with a "+N more" toggle.
 */
export function ExtractionSummary({ category }: ExtractionSummaryProps) {
  const fields = PACKAGE_CATEGORY_FIELDS[category];
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(fields.length);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const measure = measureRef.current;

    if (!measure) {
      return;
    }

    const update = () => setVisibleCount(countVisibleChips(measure));

    update();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);

    observer.observe(measure);

    return () => observer.disconnect();
  }, [fields]);

  const hiddenCount = fields.length - visibleCount;
  const shown = expanded || hiddenCount <= 0 ? fields : fields.slice(0, visibleCount);

  return (
    <div className="animate-fade-in space-y-2">
      <p className="text-callout text-text-muted">
        We&apos;ll extract{" "}
        <strong className="font-semibold text-text">
          {fields.length} measurements
        </strong>
        , the pin map and the package variant.
      </p>
      <div className="relative">
        <ul aria-label={`Measurements for ${category}`} className="flex flex-wrap gap-1.5">
          {shown.map((field) => (
            <li className={CHIP_CLASS_NAME} key={field}>
              {field}
            </li>
          ))}
          {hiddenCount > 0 ? (
            <li className="flex">
              <button
                aria-expanded={expanded}
                className={MORE_CLASS_NAME}
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                {expanded ? "Show less" : `+${hiddenCount} more`}
              </button>
            </li>
          ) : null}
        </ul>
        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-0 flex-wrap gap-1.5 overflow-hidden"
          ref={measureRef}
        >
          {fields.map((field) => (
            <span className={CHIP_CLASS_NAME} data-chip key={field}>
              {field}
            </span>
          ))}
          <span className={cn(MORE_CLASS_NAME, "pointer-coarse:min-h-0")} data-more>
            +{fields.length} more
          </span>
        </div>
      </div>
    </div>
  );
}
