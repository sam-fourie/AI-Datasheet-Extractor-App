"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, IconButton, LinkButton } from "@/components/ui";

import { DatasheetViewerBody, formatPdfContext, type PdfContext } from "./datasheet-pane";
import type { PdfPaneState } from "./use-pdf-viewer";

export type DatasheetSheetProps = {
  context: PdfContext | null;
  fileName: string;
  newTabHref: string | null;
  onClose: () => void;
  onRetry: () => void;
  onStep: (direction: 1 | -1) => void;
  open: boolean;
  originalUrl: string | null;
  page: number | null;
  partNumber: string;
  revisionNote: ReactNode;
  state: PdfPaneState;
};

/**
 * Tablet datasheet (768–1279 px, fine pointers only): a right sheet at
 * min(720px, 72vw) opened at the requested page (§4.3). It does not follow
 * the active row; the page stepper walks the row's evidence pages.
 */
export function DatasheetSheet({
  context,
  fileName,
  newTabHref,
  onClose,
  onRetry,
  onStep,
  open,
  originalUrl,
  page,
  partNumber,
  revisionNote,
  state,
}: DatasheetSheetProps) {
  const pageCount = context?.pages.length ?? 0;
  const contextText = formatPdfContext(page, context);

  return (
    <Dialog
      className="w-[min(720px,72vw)]! max-w-none!"
      description={
        <span className="block truncate">
          {fileName}
          {contextText ? ` · ${contextText}` : ""}
        </span>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title="Datasheet"
      variant="sheet-right"
    >
      <div className="-mx-5 -mt-4 flex h-[calc(100%+2.25rem)] min-h-[60dvh] flex-col">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border-subtle px-3">
          <IconButton
            disabled={pageCount < 2}
            icon={<ChevronLeft />}
            label="Previous evidence page"
            onClick={() => onStep(-1)}
            size="sm"
          />
          <span className="min-w-11 text-center text-caption text-text-muted tabular-nums">
            {pageCount > 0 && context && context.index >= 0 ? `${context.index + 1} of ${pageCount}` : "—"}
          </span>
          <IconButton
            disabled={pageCount < 2}
            icon={<ChevronRight />}
            label="Next evidence page"
            onClick={() => onStep(1)}
            size="sm"
          />
          <span className="flex-1" />
          {newTabHref ? (
            <LinkButton external href={newTabHref} size="sm" variant="ghost">
              Open in new tab
            </LinkButton>
          ) : null}
        </div>
        {revisionNote && state.status === "ready" ? (
          <p className="shrink-0 border-b border-border-subtle px-4 py-1.5 text-caption text-text-muted">
            {revisionNote}
          </p>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col bg-surface-sunken">
          <DatasheetViewerBody
            onRetry={onRetry}
            originalUrl={originalUrl}
            page={page}
            partNumber={partNumber}
            state={state}
          />
        </div>
      </div>
    </Dialog>
  );
}
