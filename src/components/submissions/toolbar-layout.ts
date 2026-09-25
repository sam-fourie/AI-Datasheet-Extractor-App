/**
 * Toolbar layout, shared with `(list)/loading.tsx` so the skeleton matches.
 * The wrapper is a size container: below 64rem of toolbar width (where the
 * controls cannot fit on one line) search and status share the first row and
 * category and sort sit on a left-aligned second row; from 64rem up it is one
 * row with category and sort at the right.
 */
export const toolbarContainerClassName = "@container";
export const toolbarRowClassName =
  "flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center @5xl:flex-nowrap";
export const toolbarSearchClassName =
  "w-full md:w-auto md:min-w-64 md:flex-1 @5xl:w-72 @5xl:flex-none";
export const toolbarTrailingClassName =
  "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 md:flex md:w-full md:items-center @5xl:ml-auto @5xl:w-auto";
