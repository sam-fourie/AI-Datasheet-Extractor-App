"use client";

import { useMemo } from "react";

import { Combobox, Field, type ComboboxGroup } from "@/components/ui";
import {
  PACKAGE_CATEGORY_FIELDS,
  PACKAGE_CATEGORY_GROUPS,
  PACKAGE_CATEGORY_KEYWORDS,
  type PackageCategory,
} from "@/lib/package-categories";

import { ExtractionSummary } from "./extraction-summary";

export type PackageCategoryFieldProps = {
  error: string | null;
  onChange: (value: PackageCategory) => void;
  /** Most recent distinct categories from the index, newest first (max 3). */
  recentCategories: readonly PackageCategory[];
  value: PackageCategory | null;
};

export const PACKAGE_CATEGORY_INPUT_ID = "package-category";

function toOption(category: PackageCategory) {
  const count = PACKAGE_CATEGORY_FIELDS[category].length;

  return {
    keywords: [...(PACKAGE_CATEGORY_KEYWORDS[category] ?? [])],
    label: category,
    meta: `${count} fields`,
    value: category,
  };
}

function isPackageCategory(value: string): value is PackageCategory {
  return Object.prototype.hasOwnProperty.call(PACKAGE_CATEGORY_FIELDS, value);
}

/**
 * Searchable package category (spec §4.1): grouped, with abbreviation
 * keywords ("qfn", "soic"), field counts, and a "Recently used" group.
 */
export function PackageCategoryField({
  error,
  onChange,
  recentCategories,
  value,
}: PackageCategoryFieldProps) {
  const groups = useMemo<ComboboxGroup[]>(() => {
    // Recently used categories move to the top group, so each option is listed once.
    const catalog = PACKAGE_CATEGORY_GROUPS.map((group) => ({
      label: group.label,
      options: group.categories
        .filter((category) => !recentCategories.includes(category))
        .map(toOption),
    })).filter((group) => group.options.length > 0);

    return recentCategories.length > 0
      ? [{ label: "Recently used", options: recentCategories.map(toOption) }, ...catalog]
      : catalog;
  }, [recentCategories]);

  return (
    <div className="min-w-0 space-y-3">
      <Field
        error={error}
        htmlFor={PACKAGE_CATEGORY_INPUT_ID}
        label="Package category"
        required
      >
        <Combobox
          controlSize="lg"
          emptyText="No matching package categories"
          groups={groups}
          id={PACKAGE_CATEGORY_INPUT_ID}
          invalid={Boolean(error)}
          onChange={(next) => {
            if (isPackageCategory(next)) {
              onChange(next);
            }
          }}
          placeholder="Search, e.g. SOIC or QFN"
          value={value}
        />
      </Field>
      {value ? <ExtractionSummary category={value} key={value} /> : null}
      <p aria-live="polite" className="sr-only">
        {value
          ? `We'll extract ${PACKAGE_CATEGORY_FIELDS[value].length} measurements, the pin map and the package variant.`
          : ""}
      </p>
    </div>
  );
}
