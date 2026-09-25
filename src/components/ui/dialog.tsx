"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { X } from "lucide-react";

import { cn } from "./cn";
import { IconButton } from "./icon-button";

export type DialogVariant = "center" | "sheet-right" | "sheet-bottom";
export type DialogSize = "sm" | "md" | "lg";

export type DialogProps = {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  /** Buttons row. Put the safe action first in the markup. */
  footer?: ReactNode;
  /** Hides the close button (alert dialogs never show one). */
  hideCloseButton?: boolean;
  /** Element focused on open. Defaults to the first control in the body or footer. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  role?: "dialog" | "alertdialog";
  size?: DialogSize;
  title: ReactNode;
  variant?: DialogVariant;
  /**
   * CSS length that replaces the variant and size width, e.g.
   * `"min(720px, 72vw)"`. It is still capped to the viewport.
   */
  width?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeWidths: Record<DialogSize, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[720px]",
};

const variantClassNames: Record<DialogVariant, string> = {
  center:
    "m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] rounded-lg motion-safe:open:animate-dialog-in",
  "sheet-right":
    "my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-[min(100%,520px)] rounded-l-lg motion-safe:open:animate-sheet-right-in",
  "sheet-bottom":
    "mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-full rounded-t-lg pb-[env(safe-area-inset-bottom)] motion-safe:open:animate-sheet-bottom-in",
};

/**
 * Modal dialog on the native `<dialog>` element with `showModal()`: the page
 * behind is inert, focus is trapped, Escape fires `cancel`, and focus returns
 * to the opener on close.
 */
export function Dialog({
  children,
  className,
  description,
  footer,
  hideCloseButton = false,
  initialFocusRef,
  onClose,
  open,
  role = "dialog",
  size = "md",
  title,
  variant = "center",
  width,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const isAlert = role === "alertdialog";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      openerRef.current = document.activeElement;
      dialog.showModal();

      const target =
        initialFocusRef?.current ??
        contentRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        Array.from(
          contentRef.current?.querySelectorAll<HTMLElement>(
            FOCUSABLE_SELECTOR,
          ) ?? [],
        ).find((element) => !element.closest("[data-dialog-close]")) ??
        contentRef.current;

      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialFocusRef, open]);

  useEffect(() => {
    const dialog = dialogRef.current;

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Escape: keep the element open until the owner flips `open`.
    event.preventDefault();
    onCloseRef.current();
  }

  function handleClose() {
    const opener = openerRef.current;
    openerRef.current = null;

    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus();
    }

    if (open) {
      onCloseRef.current();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (!isAlert && event.target === event.currentTarget) {
      onCloseRef.current();
    }
  }

  const isSheet = variant !== "center";

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn(
        "border-0 bg-surface p-0 text-text shadow-overlay open:flex open:flex-col",
        variantClassNames[variant],
        !width && variant !== "sheet-right" && sizeWidths[size],
        !width &&
          variant === "sheet-right" &&
          size === "lg" &&
          "max-w-[min(100%,720px)]",
        !width &&
          variant === "sheet-right" &&
          size === "sm" &&
          "max-w-[min(100%,400px)]",
        className,
      )}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onClose={handleClose}
      ref={dialogRef}
      role={role}
      style={
        width
          ? {
              maxWidth: variant === "center" ? "calc(100% - 32px)" : "100%",
              width,
            }
          : undefined
      }
    >
      {open ? (
        <div
          className="flex min-h-0 flex-1 flex-col outline-none"
          ref={contentRef}
          tabIndex={-1}
        >
          <div
            className={cn(
              "flex items-start gap-3 px-5 pt-5",
              isSheet && "pb-4 border-b border-border-subtle",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-title-3 text-text" id={titleId}>
                {title}
              </h2>
              {description ? (
                <div
                  className="text-callout text-text-muted"
                  id={descriptionId}
                >
                  {description}
                </div>
              ) : null}
            </div>
            {!hideCloseButton && !isAlert ? (
              <IconButton
                className="-mt-1 -mr-2"
                data-dialog-close=""
                icon={<X />}
                label="Close"
                onClick={() => onCloseRef.current()}
                size="sm"
                tooltip={false}
              />
            ) : null}
          </div>
          {children ? (
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-5 pt-4 text-body",
                !footer && "pb-5",
              )}
            >
              {children}
            </div>
          ) : (
            <div className={footer ? "pt-1" : "pb-5"} />
          )}
          {footer ? (
            <div
              className={cn(
                "flex flex-col-reverse gap-2 px-5 pt-4 pb-5 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto",
                isSheet && "mt-auto border-t border-border-subtle pt-4",
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
