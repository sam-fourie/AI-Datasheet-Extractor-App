"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileX,
  PanelRightClose,
  TriangleAlert,
} from "lucide-react";

import {
  Button,
  EmptyState,
  IconButton,
  LinkButton,
  Spinner,
  Switch,
  Tooltip,
  cn,
} from "@/components/ui";

import { DATASHEET_HIDE_BUTTON_ID } from "./types";
import type { PdfPaneState } from "./use-pdf-viewer";

/** What the datasheet is showing: the row it follows and that row's evidence pages. */
export type PdfContext = {
  /** "Body Length", "Pin 8, VCC", "Package", or null for a page shown on its own. */
  label: string | null;
  /** The row's evidence pages ([ / ] step through them). */
  pages: number[];
  /** Index of the shown page in `pages`, or -1. */
  index: number;
};

/** "p. 30 · Body Length" */
export function formatPdfContext(page: number | null, context: PdfContext | null) {
  const parts = [page ? `p. ${page}` : null, context?.label ?? null].filter(Boolean);

  return parts.join(" · ");
}

/** Stop showing the loading cover if the viewer never reports load. */
const LOAD_FALLBACK_MS = 10_000;

function subscribeNever() {
  return () => {};
}

function buildSrc(url: string, page: number | null) {
  const base = url.split("#")[0];
  // navpanes=0: Chrome's viewer (and Acrobat) otherwise opens the thumbnail
  // sidebar in panes wider than ~460 px, squeezing the page to ~160 px.
  // pagemode=none does the same for Firefox's pdf.js. Unknown keys are ignored.
  const params = "view=FitH&navpanes=0&pagemode=none";

  return page ? `${base}#page=${page}&${params}` : `${base}#${params}`;
}

export type DatasheetViewerBodyProps = {
  className?: string;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  onRetry: () => void;
  originalUrl: string | null;
  /** 1-based page to show. The iframe remounts (keyed by page) only when it changes. */
  page: number | null;
  partNumber: string;
  state: PdfPaneState;
};

/**
 * The datasheet itself, shared by the xl pane and the tablet sheet: the
 * iframe when ready, otherwise the loading, caching, error or unavailable
 * state (§4.3 pane states).
 */
export function DatasheetViewerBody({
  className,
  iframeRef,
  onRetry,
  originalUrl,
  page,
  partNumber,
  state,
}: DatasheetViewerBodyProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // The iframe mounts after hydration only, so its load event can never fire
  // before React listens for it (a server-rendered iframe could finish first).
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const src = state.status === "ready" ? buildSrc(state.viewer.url, page) : null;

  // Some PDF viewers never fire load; stop covering the frame after a while.
  useEffect(() => {
    if (!src || !isClient) {
      return;
    }

    const timer = window.setTimeout(() => setLoadedSrc(src), LOAD_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [isClient, src]);

  if (state.status === "ready" && src) {
    const loaded = loadedSrc === src;

    return (
      <div className={cn("relative min-h-0 flex-1", className)}>
        {isClient ? (
          <iframe
            className="absolute inset-0 size-full rounded-tl-md border-0 bg-surface"
            key={page ?? 0}
            onLoad={() => setLoadedSrc(src)}
            ref={iframeRef}
            src={src}
            title={`Datasheet for ${partNumber}`}
          />
        ) : null}
        {loaded ? null : <LoadingState />}
      </div>
    );
  }

  if (state.status === "caching") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center",
          className,
        )}
        role="status"
      >
        <Spinner className="text-text-muted" size={20} />
        <p className="max-w-xs text-callout text-text-muted">
          {state.host ? `Fetching the PDF from ${state.host}.` : "Fetching the PDF."} This only
          happens once.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={cn("flex min-h-0 flex-1 items-center justify-center", className)}>
        <EmptyState
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={onRetry} size="sm" variant="secondary">
                Try again
              </Button>
              {originalUrl ? (
                <LinkButton external href={originalUrl} size="sm" variant="ghost">
                  Open original
                </LinkButton>
              ) : null}
            </div>
          }
          description={
            originalUrl
              ? "The site didn't send the PDF. The link may have moved, or the site blocks downloads."
              : state.message
          }
          icon={<TriangleAlert />}
          title="Couldn't load the datasheet"
          titleAs="p"
        />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className={cn("flex min-h-0 flex-1 items-center justify-center", className)}>
        <EmptyState
          description="Only the extracted values were saved with this submission."
          icon={<FileX />}
          title="The PDF wasn't kept for this submission"
          titleAs="p"
        />
      </div>
    );
  }

  return <LoadingState className={className} />;
}

function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center gap-3 bg-surface-sunken px-6 pt-6 motion-safe:animate-fade-in motion-safe:[animation-delay:150ms]",
        className,
      )}
      role="status"
    >
      <div aria-hidden="true" className="aspect-[1/1.3] w-full max-w-[520px] rounded-md bg-surface motion-safe:animate-pulse" />
      <p className="text-callout text-text-muted">Loading datasheet…</p>
    </div>
  );
}

export type DatasheetPaneProps = {
  className?: string;
  context: PdfContext | null;
  fileName: string;
  follow: boolean;
  newTabHref: string | null;
  onCollapse: () => void;
  onFollowChange: (follow: boolean) => void;
  onRetry: () => void;
  onStep: (direction: 1 | -1) => void;
  originalUrl: string | null;
  page: number | null;
  partNumber: string;
  /** Addendum F: "Cached copy from {date}; …" when the viewer shows a later vendor copy. */
  revisionNote: ReactNode;
  state: PdfPaneState;
};

/**
 * The xl datasheet pane (§4.3, §5.11): a 40 px toolbar (file, context, page
 * stepper, Follow, new tab, collapse) over the PDF. Sticky under the review
 * header, full viewport height.
 */
export function DatasheetPane({
  className,
  context,
  fileName,
  follow,
  newTabHref,
  onCollapse,
  onFollowChange,
  onRetry,
  onStep,
  originalUrl,
  page,
  partNumber,
  revisionNote,
  state,
}: DatasheetPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHasFocus, setIframeHasFocus] = useState(false);
  const pageCount = context?.pages.length ?? 0;
  const stepDisabled = pageCount < 2;
  const contextText = formatPdfContext(page, context);

  // Keys typed into the PDF never reach the page (addendum G).
  useEffect(() => {
    function handleBlur() {
      window.setTimeout(() => {
        const frame = iframeRef.current;

        if (frame && document.activeElement === frame) {
          setIframeHasFocus(true);
        }
      }, 0);
    }

    function handleFocus() {
      setIframeHasFocus(false);
    }

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <aside
      aria-label="Datasheet"
      className={cn("flex-col border-l border-border bg-surface-sunken", className)}
      data-review-pane=""
    >
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-surface-subtle pr-1.5 pl-3">
        <FileText aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
        <p
          className="min-w-0 flex-1 truncate text-callout"
          title={[fileName, contextText].filter(Boolean).join(" · ")}
        >
          {iframeHasFocus ? (
            <span className="text-accent-text">Click the list to keep using shortcuts</span>
          ) : (
            <>
              <span className="font-medium text-text max-2xl:sr-only">{fileName}</span>
              {contextText ? (
                <>
                  <span aria-hidden="true" className="text-text-tertiary max-2xl:hidden">
                    {" · "}
                  </span>
                  <span className="text-text-muted tabular-nums">{contextText}</span>
                </>
              ) : null}
            </>
          )}
        </p>
        <div className="flex shrink-0 items-center">
          <IconButton
            disabled={stepDisabled}
            icon={<ChevronLeft />}
            label="Previous evidence page"
            onClick={() => onStep(-1)}
            shortcut="["
            size="sm"
          />
          <span
            aria-live="off"
            className={cn(
              "min-w-11 text-center text-caption tabular-nums",
              stepDisabled ? "text-text-tertiary" : "text-text-muted",
            )}
          >
            {pageCount > 0 && context && context.index >= 0
              ? `${context.index + 1} of ${pageCount}`
              : pageCount > 0
                ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}`
                : "—"}
          </span>
          <IconButton
            disabled={stepDisabled}
            icon={<ChevronRight />}
            label="Next evidence page"
            onClick={() => onStep(1)}
            shortcut="]"
            size="sm"
          />
        </div>
        <Tooltip content="Show the active row's page as you move through the list">
          <Switch
            checked={follow}
            className="mx-1 shrink-0"
            label={<span className="text-callout font-normal text-text-muted">Follow</span>}
            onChange={(event) => onFollowChange(event.target.checked)}
          />
        </Tooltip>
        {newTabHref && state.status === "ready" ? (
          <Tooltip content="Open in new tab" describeChild={false}>
            <LinkButton
              aria-label="Open datasheet in new tab"
              external
              href={newTabHref}
              iconOnly
              size="sm"
              variant="ghost"
            >
              <ArrowUpRight aria-hidden="true" />
            </LinkButton>
          </Tooltip>
        ) : null}
        <IconButton
          icon={<PanelRightClose />}
          id={DATASHEET_HIDE_BUTTON_ID}
          label="Hide datasheet"
          onClick={onCollapse}
          size="sm"
          tooltipSide="left"
        />
      </div>
      {revisionNote && state.status === "ready" ? (
        <p className="shrink-0 border-b border-border-subtle bg-surface-subtle px-3 py-1.5 text-caption text-text-muted">
          {revisionNote}
        </p>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col pt-2 pl-2">
        <DatasheetViewerBody
          iframeRef={iframeRef}
          onRetry={onRetry}
          originalUrl={originalUrl}
          page={page}
          partNumber={partNumber}
          state={state}
        />
      </div>
    </aside>
  );
}
