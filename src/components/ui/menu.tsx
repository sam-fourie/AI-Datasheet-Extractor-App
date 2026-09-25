"use client";

import {
  cloneElement,
  isValidElement,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type ToggleEvent,
} from "react";
import { ArrowUpRight, Check } from "lucide-react";

import { AppLink } from "@/components/app-link";

import { cn } from "./cn";
import { floatingBaseClassName, type FloatingAlign } from "./floating";
import { useAnchoredPopover } from "./use-anchored-popover";

export type MenuItemRole = "menuitemradio" | "menuitemcheckbox";

export type MenuItem = {
  /**
   * Makes the item checkable: it renders as `itemRole` (default
   * `menuitemradio`) with `aria-checked` and a leading check glyph. Once any
   * item in a menu sets it, every item reserves the glyph column.
   */
  checked?: boolean;
  disabled?: boolean;
  /** Shown under the label when the item is disabled. */
  disabledReason?: string;
  external?: boolean;
  href?: string;
  icon?: ReactNode;
  /** Role for a checkable item; ignored unless `checked` is set. */
  itemRole?: MenuItemRole;
  label: string;
  onSelect?: () => void;
  shortcut?: string;
  tone?: "default" | "danger";
};

export type MenuEntry = MenuItem | "separator";

type MenuTriggerProps = {
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "menu";
  popoverTarget?: string;
};

export type MenuProps = {
  align?: FloatingAlign;
  items: MenuEntry[];
  /** Accessible name for the menu; defaults to the trigger's name. */
  label?: string;
  minWidth?: number;
  onOpenChange?: (open: boolean) => void;
  /** A Button or IconButton. It receives popoverTarget and ARIA wiring. */
  trigger: ReactElement<MenuTriggerProps>;
};

const itemClassName =
  "flex min-h-8 w-full select-none items-center gap-2 rounded-xs px-2 py-1.5 text-left text-body outline-none focus:bg-surface-selected focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0";

function getItemElements(menu: HTMLElement | null) {
  if (!menu) {
    return [];
  }

  return Array.from(
    menu.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
    ),
  );
}

/**
 * Menu button (APG pattern) on a `popover="auto"` element: top layer, light
 * dismiss and Escape come from the platform. Arrow keys, Home, End and
 * type-ahead move between items; Tab closes the menu.
 */
export function Menu({
  align = "start",
  items,
  label,
  minWidth = 200,
  onOpenChange,
  trigger,
}: MenuProps) {
  const focusLastOnOpen = useRef(false);
  const {
    close,
    handleBeforeToggle,
    handleToggle,
    open,
    openPopover,
    popoverId,
    popoverRef,
    triggerWrapperRef,
  } = useAnchoredPopover({ align, onOpenChange });

  function focusItem(index: number) {
    const elements = getItemElements(popoverRef.current);

    if (elements.length === 0) {
      return;
    }

    const bounded = (index + elements.length) % elements.length;
    elements[bounded]?.focus();
  }

  function handleMenuToggle(event: ToggleEvent<HTMLDivElement>) {
    handleToggle(event);

    if (event.newState === "open") {
      focusItem(focusLastOnOpen.current ? -1 : 0);
      focusLastOnOpen.current = false;
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (
      event.defaultPrevented ||
      event.target !== triggerWrapperRef.current?.firstElementChild
    ) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusLastOnOpen.current = event.key === "ArrowUp";

      if (open) {
        focusItem(focusLastOnOpen.current ? -1 : 0);
        focusLastOnOpen.current = false;
      } else {
        openPopover();
      }
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const elements = getItemElements(popoverRef.current);
    const currentIndex = elements.indexOf(
      document.activeElement as HTMLElement,
    );

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(currentIndex + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusItem(currentIndex - 1);
        return;
      case "Home":
      case "PageUp":
        event.preventDefault();
        focusItem(0);
        return;
      case "End":
      case "PageDown":
        event.preventDefault();
        focusItem(-1);
        return;
      case "Tab":
        close();
        return;
      default:
        break;
    }

    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const character = event.key.toLowerCase();
      const ordered = [
        ...elements.slice(currentIndex + 1),
        ...elements.slice(0, currentIndex + 1),
      ];
      const match = ordered.find((element) =>
        (element.dataset.label ?? "").toLowerCase().startsWith(character),
      );

      match?.focus();
    }
  }

  function selectItem(item: MenuItem) {
    close();
    item.onSelect?.();
  }

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        "aria-controls": popoverId,
        "aria-expanded": open,
        "aria-haspopup": "menu",
        popoverTarget: popoverId,
      })
    : trigger;
  const hasCheckable = items.some(
    (item) => item !== "separator" && item.checked !== undefined,
  );

  return (
    <>
      <span
        className="contents"
        onKeyDown={handleTriggerKeyDown}
        ref={triggerWrapperRef}
      >
        {triggerElement}
      </span>
      <div
        aria-label={label}
        className={cn(
          floatingBaseClassName,
          "z-50 max-h-[min(24rem,calc(100dvh-16px))] overflow-y-auto rounded-md bg-surface p-1.5 shadow-overlay motion-safe:open:animate-float-in",
        )}
        id={popoverId}
        onBeforeToggle={handleBeforeToggle}
        onKeyDown={handleMenuKeyDown}
        onToggle={handleMenuToggle}
        popover="auto"
        ref={popoverRef}
        role="menu"
        style={{ minWidth }}
      >
        {items.map((item, index) => {
          if (item === "separator") {
            return (
              <div
                className="-mx-1.5 my-1.5 h-px bg-border-subtle"
                key={`separator-${index}`}
                role="separator"
              />
            );
          }

          const isCheckable = item.checked !== undefined;
          const role = isCheckable
            ? (item.itemRole ?? "menuitemradio")
            : "menuitem";
          const ariaChecked = isCheckable ? Boolean(item.checked) : undefined;
          const content = (
            <>
              {hasCheckable ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex",
                    item.disabled ? "text-text-tertiary" : "text-accent",
                    !item.checked && "invisible",
                  )}
                >
                  <Check />
                </span>
              ) : null}
              {item.icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex",
                    item.tone === "danger" ? "text-danger" : "text-text-muted",
                    item.disabled && "text-text-tertiary",
                  )}
                >
                  {item.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.disabled && item.disabledReason ? (
                  <span className="block text-caption text-text-muted">
                    {item.disabledReason}
                  </span>
                ) : null}
              </span>
              {item.external ? (
                <ArrowUpRight aria-hidden="true" className="text-text-muted" />
              ) : null}
              {item.shortcut ? (
                <span className="ml-4 text-callout text-text-muted">
                  {item.shortcut}
                </span>
              ) : null}
            </>
          );
          const toneClassName = cn(
            itemClassName,
            item.tone === "danger" ? "text-danger" : "text-text",
            item.disabled && "cursor-not-allowed text-text-tertiary",
          );
          const key = `${item.label}-${index}`;
          const onPointerMove = (event: PointerEvent<HTMLElement>) => {
            if (
              event.pointerType === "mouse" &&
              document.activeElement !== event.currentTarget
            ) {
              event.currentTarget.focus();
            }
          };

          if (item.href && !item.disabled) {
            if (item.external) {
              return (
                <a
                  className={toneClassName}
                  data-label={item.label}
                  href={item.href}
                  key={key}
                  onClick={() => selectItem(item)}
                  onPointerMove={onPointerMove}
                  rel="noopener"
                  aria-checked={ariaChecked}
                  role={role}
                  tabIndex={-1}
                  target="_blank"
                >
                  {content}
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              );
            }

            return (
              <AppLink
                className={toneClassName}
                data-label={item.label}
                href={item.href}
                key={key}
                onClick={() => selectItem(item)}
                onPointerMove={onPointerMove}
                aria-checked={ariaChecked}
                role={role}
                tabIndex={-1}
              >
                {content}
              </AppLink>
            );
          }

          return (
            <button
              aria-disabled={item.disabled || undefined}
              className={toneClassName}
              data-label={item.label}
              key={key}
              onClick={() => {
                if (!item.disabled) {
                  selectItem(item);
                }
              }}
              onPointerMove={onPointerMove}
              aria-checked={ariaChecked}
              role={role}
              tabIndex={-1}
              type="button"
            >
              {content}
            </button>
          );
        })}
      </div>
    </>
  );
}
