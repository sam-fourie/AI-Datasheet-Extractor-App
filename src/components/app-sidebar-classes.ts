/**
 * Class names shared by the desktop sidebar's server and client parts. This is
 * a plain module on purpose: a value exported from a "use client" module
 * reaches Server Components as a client reference, not the string.
 */

/**
 * Hides sidebar text while the rail is collapsed and fades it in once the
 * panel has widened (after the hover dwell), or at once for keyboard focus.
 * The text stays in the accessibility tree either way.
 */
export const SIDEBAR_REVEAL_CLASS_NAME =
  "opacity-0 transition-opacity duration-(--ui-duration-fast) ease-ui group-hover/sidebar:opacity-100 group-hover/sidebar:delay-200 group-has-[:focus-visible]/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:delay-0";
