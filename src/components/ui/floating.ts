export type FloatingAlign = "start" | "end";
export type FloatingSide = "top" | "bottom" | "left" | "right";

const VIEWPORT_MARGIN = 8;

type PositionOptions = {
  align?: FloatingAlign | "center";
  offset?: number;
  side?: FloatingSide;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Positions a `position: fixed` top-layer element (a popover) next to its
 * anchor. Flips to the opposite side when there is not enough room and keeps
 * the element inside the viewport. Mutates `floating.style` directly so it
 * can run from event handlers without a re-render.
 */
export function positionFloating(
  anchor: Element,
  floating: HTMLElement,
  { align = "start", offset = 4, side = "bottom" }: PositionOptions = {},
) {
  const anchorRect = anchor.getBoundingClientRect();
  const floatingRect = floating.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = viewportWidth - floatingRect.width - VIEWPORT_MARGIN;
  const maxTop = viewportHeight - floatingRect.height - VIEWPORT_MARGIN;

  let top: number;
  let left: number;

  if (side === "top" || side === "bottom") {
    const spaceBelow = viewportHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const needed = floatingRect.height + offset + VIEWPORT_MARGIN;
    let resolvedSide = side;

    if (side === "bottom" && spaceBelow < needed && spaceAbove > spaceBelow) {
      resolvedSide = "top";
    } else if (
      side === "top" &&
      spaceAbove < needed &&
      spaceBelow > spaceAbove
    ) {
      resolvedSide = "bottom";
    }

    top =
      resolvedSide === "bottom"
        ? anchorRect.bottom + offset
        : anchorRect.top - offset - floatingRect.height;

    if (align === "start") {
      left = anchorRect.left;
    } else if (align === "end") {
      left = anchorRect.right - floatingRect.width;
    } else {
      left = anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2;
    }

    floating.dataset.side = resolvedSide;
  } else {
    const spaceRight = viewportWidth - anchorRect.right;
    const spaceLeft = anchorRect.left;
    const needed = floatingRect.width + offset + VIEWPORT_MARGIN;
    let resolvedSide = side;

    if (side === "right" && spaceRight < needed && spaceLeft > spaceRight) {
      resolvedSide = "left";
    } else if (
      side === "left" &&
      spaceLeft < needed &&
      spaceRight > spaceLeft
    ) {
      resolvedSide = "right";
    }

    left =
      resolvedSide === "right"
        ? anchorRect.right + offset
        : anchorRect.left - offset - floatingRect.width;
    top = anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2;
    floating.dataset.side = resolvedSide;
  }

  floating.style.left = `${Math.round(clamp(left, VIEWPORT_MARGIN, maxLeft))}px`;
  floating.style.top = `${Math.round(clamp(top, VIEWPORT_MARGIN, maxTop))}px`;
}

/** Shared reset for `popover` elements positioned with `positionFloating`. */
export const floatingBaseClassName =
  "fixed m-0 [inset:auto] border-0 text-text";
