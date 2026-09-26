"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  FileText,
  Globe,
  Info,
  Keyboard,
  Link2,
  Play,
  Rows3,
  Trash2,
  Undo2,
} from "lucide-react";

import { useBackgroundTasks } from "@/components/background-tasks-provider";
import {
  DeleteSubmissionDialog,
  RUN_IN_PROGRESS_REASON,
  type DeleteSubmissionTarget,
} from "@/components/delete-submission-dialog";
import { RelativeTime } from "@/components/relative-time";
import { ReviewStatusBadge, type ReviewStatusRerun } from "@/components/review-status-badge";
import {
  Button,
  Dialog,
  Kbd,
  Spinner,
  Tooltip,
  useToast,
  type MenuEntry,
} from "@/components/ui";
import { formatRunLabel } from "@/lib/ai/provider-meta";
import {
  indexAgreementRowsByRerunKey,
  isScoredAgreement,
  listMatchingPendingRefs,
  listOnlyInBaselineRows,
} from "@/lib/submissions/agreement";
import {
  applyCorrection,
  bulkConfirm,
  countReviewDecisions,
  countSectionDecisions,
  deriveReviewProgress,
  findNextPendingRow,
  getInitialReviewMode,
  listReviewRowRefs,
  normalizeSubmissionReview,
  rowKeyOf,
  setDecision,
  type CorrectionInput,
  type ReviewMode,
  type ReviewRowRef,
} from "@/lib/submissions/review";
import {
  computeVisibleRows,
  createAttentionContextResolver,
  type FilteredSection,
  type ReviewFilter,
} from "@/lib/submissions/review-filters";
import { describeSubmissionSource, getSubmissionPdfHref } from "@/lib/submissions/source";
import type {
  BaselineRunHints,
  NextReviewTarget,
  SubmissionDetail,
  SubmissionModelRun,
} from "@/lib/submissions/types";

import { AgreementSummary } from "./agreement-summary";
import { AiNotesCallout } from "./ai-notes-callout";
import { ArrivalBanner } from "./arrival-banner";
import { CompletionCard } from "./completion-card";
import { DatasheetPane, type PdfContext } from "./datasheet-pane";
import { DatasheetSheet } from "./datasheet-sheet";
import { SubmissionDetails } from "./details-popover";
import { LocalDate } from "./local-date";
import { MeasurementReviewList } from "./measurement-review-list";
import { MobileReviewBar } from "./mobile-review-bar";
import { ModelRunsSection } from "./model-runs-section";
import { PackageReviewBlock } from "./package-review-block";
import { getPinDisplayOrder, PinReviewList } from "./pin-review-list";
import { RerunDialog } from "./rerun-dialog";
import { RestoreDraftCallout } from "./restore-draft-callout";
import { ReviewHeader } from "./review-header";
import {
  liveReviewServices,
  type InitialPdfViewer,
  type RerunSettings,
  type ReviewWorkspaceServices,
} from "./review-services";
import {
  ARRIVAL_KEY_PREFIX,
  LIST_QUERY_KEY,
  readSession,
  removeSession,
  STORAGE_KEYS,
  useMediaQuery,
  useMountValue,
  useStoredBoolean,
} from "./review-storage";
import { ReviewToolbar, type ToolbarSection } from "./review-toolbar";
import { ReviewerNotesSection } from "./reviewer-notes-section";
import { ElapsedTime, RunSwitcher, RunSwitcherSheet } from "./run-switcher";
import { ShortcutsDialog } from "./shortcuts-dialog";
import {
  correctionInputDomId,
  DATASHEET_HIDE_BUTTON_ID,
  DATASHEET_OPEN_BUTTON_ID,
  PIN_SEARCH_INPUT_ID,
  REVIEW_SECTION_IDS,
  rowDomId,
  rowRefFromDomId,
  type BulkConfirmScope,
  type ReviewRowCallbacks,
  type RowComparisonContext,
} from "./types";
import { useReviewDraft } from "./use-review-draft";
import { useReviewKeyboard } from "./use-review-keyboard";
import { usePdfViewer } from "./use-pdf-viewer";
import { useScrollSpy } from "./use-scroll-spy";
import {
  computeArrivalStats,
  countFilters,
  countReruns,
  describeCompletion,
  describeRowShort,
  describeRunAgreement,
  formatModelDotEffort,
  formatModelName,
  formatModelWithEffort,
  getRowEvidencePages,
  listBulkConfirmChanges,
  pluralize,
  refreshCompletion,
  revertBulkConfirm,
  shortTaskName,
  type CompletionState,
} from "./workspace-model";

export type ReviewWorkspaceProps = {
  /** Server defaults (OPENAI_MODEL / OPENAI_REASONING_EFFORT) for the re-run dialog. */
  defaultSettings: { model: string; reasoningEffort: string };
  initialSubmission: SubmissionDetail;
  /** The oldest other pending baseline, for the completion card. */
  nextReview: NextReviewTarget | null;
  /** resolvePdfViewer(submission) on the server. */
  pdfViewer: InitialPdfViewer;
  /** Baselines only: buildBaselineRunHints(runs). */
  runHints: BaselineRunHints | null;
  /** listSubmissionModelRuns(rootId): the baseline first, then re-runs oldest first. */
  runs: SubmissionModelRun[];
  /** Network side; defaults to the live route handlers. The preview passes stubs. */
  services?: ReviewWorkspaceServices;
};

const EMPTY_KEYS: ReadonlySet<string> = new Set();

/** The row kind each section lists, for "Show all" focusing its first row. */
const SECTION_ROW_KIND = {
  measurements: "measurement",
  package: "package",
  pins: "pin",
} as const satisfies Record<FilteredSection, ReviewRowRef["kind"]>;

const SAVE_BLOCKED_TOAST_ID = "review-save-blocked";
const BULK_UNDO_TOAST_ID = "review-bulk-undo";
const COMPLETION_CARD_ID = "review-completion";
const DIRTY_REASON = "Save or discard your review changes first";

function focusElement(element: HTMLElement | null, options?: { scroll?: boolean }) {
  if (!element) {
    return false;
  }

  element.focus({ preventScroll: true });

  if (options?.scroll !== false) {
    element.scrollIntoView({ block: "nearest" });
  }

  return true;
}

/** Focuses the first of these ids that is rendered and visible. */
function focusFirstVisible(ids: readonly string[]) {
  for (const id of ids) {
    const element = document.getElementById(id);

    if (element && element.getClientRects().length > 0) {
      element.focus();
      return true;
    }
  }

  return false;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readBackHref() {
  const query = readSession(LIST_QUERY_KEY);

  return query ? `/submissions?${query.replace(/^\?/, "")}` : "/submissions";
}

/**
 * The review workspace (§4.3, §5): one continuous list of package,
 * measurements and pins beside the datasheet, with explicit save, undo,
 * keyboard review, filters and model runs. It owns all review state; the row
 * components under src/components/review are controlled by it.
 *
 * Keyed by submission id on the page, so router.refresh() never reseeds the
 * draft; later props only refresh runs, agreement and the next review target.
 */
export function ReviewWorkspace({
  defaultSettings,
  initialSubmission,
  nextReview,
  pdfViewer,
  runHints: runHintsProp,
  runs,
  services = liveReviewServices,
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const toast = useToast();
  const tasksApi = useBackgroundTasks();
  const rootRef = useRef<HTMLDivElement>(null);
  const followTimerRef = useRef<number | null>(null);
  const readHintShownRef = useRef(false);
  const runsNoticeShownRef = useRef(false);
  const runSwitcherTriggerRef = useRef<HTMLButtonElement>(null);
  const paneFocusTargetRef = useRef<string | null>(null);

  /* ------------------------------ Submission ------------------------------ */

  const submission = initialSubmission;
  const { extraction, intake } = submission;
  const submissionId = submission.submissionId;
  const partNumber = intake.partNumber;
  const isRerun = Boolean(submission.comparison);
  const rootId = submission.comparison?.baselineSubmissionId ?? submissionId;
  const baselineMissing = isRerun && !submission.comparison?.baseline;
  const agreement = submission.comparison?.agreement ?? null;
  const rerunCount = countReruns(runs);
  const baselineRun = runs.find((run) => run.isBaseline) ?? null;
  const source = describeSubmissionSource(intake.sourceMeta);
  const pdfAvailable =
    pdfViewer.status !== "unavailable" &&
    getSubmissionPdfHref(submissionId, intake.sourceMeta).available;

  const draftApi = useReviewDraft({ initialSubmission, services });
  const { draft, isDirty, saved } = draftApi;
  const savedCounts = countReviewDecisions(saved.review);

  /* -------------------------------- State --------------------------------- */

  // Captured once: router.refresh() passes a fresh initialSubmission after a
  // save, and mount-time defaults must not follow it.
  const [initialMode] = useState<ReviewMode>(() => getInitialReviewMode(initialSubmission));
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const modeRef = useRef(mode);
  const [showBaselineValues, setShowBaselineValues] = useState(false);
  // Explicit memos for what the memoised pin rows depend on (directly or via
  // PinReviewList): the compiler leaves these unmemoised in this component,
  // and a new identity on every keypress would re-render every pin row.
  const agreementByKey = useMemo(
    () => (isRerun ? indexAgreementRowsByRerunKey(agreement, extraction) : null),
    [agreement, extraction, isRerun],
  );
  const comparison = useMemo<RowComparisonContext | null>(
    () => (agreementByKey ? { agreementByKey, showBaselineValues } : null),
    [agreementByKey, showBaselineValues],
  );
  const runHints = isRerun ? null : runHintsProp;
  const contextFor = useMemo(
    () => createAttentionContextResolver({ comparison, runHints }),
    [comparison, runHints],
  );
  const pinOrder = useMemo(() => getPinDisplayOrder(extraction.pinRows), [extraction.pinRows]);

  // Every page, re-runs included, opens on All. Opening re-runs on "Differs"
  // hid every matching row, so a run that agreed with its baseline looked as
  // if it had no measurements or pins. Differing rows still show the baseline
  // value inline with a "Differs from baseline" marker, and the filter menu
  // offers Differs.
  const [filter, setFilterState] = useState<ReviewFilter>("all");
  const [stickyKeys, setStickyKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const [pinQuery, setPinQueryState] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [unappliedKey, setUnappliedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    if (initialMode !== "edit") {
      return null;
    }

    const review = normalizeSubmissionReview(extraction, initialSubmission.review);
    const initialVisible = computeVisibleRows({
      contextFor: createAttentionContextResolver({ runHints: runHintsProp }),
      extraction,
      filter: "all",
      pinOrder: getPinDisplayOrder(extraction.pinRows),
      review,
    });
    const first = findNextPendingRow(review, initialVisible.order, null);

    return first ? rowKeyOf(first) : null;
  });

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [notesExpandedChoice, setNotesExpandedChoice] = useState<boolean | null>(null);

  const [autoAdvance, setAutoAdvance] = useStoredBoolean(STORAGE_KEYS.autoAdvance, true);
  const [singleKeyShortcuts, setSingleKeyShortcuts] = useStoredBoolean(
    STORAGE_KEYS.singleKeyShortcuts,
    true,
  );
  const [follow, setFollow] = useStoredBoolean(STORAGE_KEYS.followSelection, true);
  const [paneOpenPreference, setPaneOpenPreference] = useStoredBoolean(STORAGE_KEYS.pdfOpen, true);
  const [paneOverride, setPaneOverride] = useState<boolean | null>(null);

  const isXl = useMediaQuery("(min-width: 1280px)", true);
  const isMd = useMediaQuery("(min-width: 768px)", true);
  const isCoarse = useMediaQuery("(pointer: coarse)", false);
  const isMobile = useMediaQuery("(max-width: 767.98px)", false);

  // Expanded by default when the AI flagged the extraction and the page opened
  // in edit mode (§4.3), but collapsed in the mobile intro. The initial mode is
  // used, so switching modes never moves the list.
  const notesExpanded =
    notesExpandedChoice ?? (extraction.review.needsReview && initialMode === "edit" && !isMobile);

  const arrived = useMountValue(() => {
    const key = `${ARRIVAL_KEY_PREFIX}${submissionId}`;
    const value = readSession(key);

    if (value !== null) {
      removeSession(key);
    }

    return value !== null;
  }, false);
  const backHref = useMountValue(readBackHref, "/submissions");
  const hashKey = useMountValue(() => {
    const ref = rowRefFromDomId(extraction, window.location.hash);

    return ref ? rowKeyOf(ref) : null;
  }, null);
  const [hashApplied, setHashApplied] = useState(false);

  /* ----------------------------- Derived rows ------------------------------ */

  const refByKey = new Map(listReviewRowRefs(extraction).map((ref) => [rowKeyOf(ref), ref]));
  const visible = useMemo(
    () =>
      computeVisibleRows({
        contextFor,
        extraction,
        filter,
        pinOrder,
        pinQuery,
        review: draft,
        stickyKeys,
      }),
    [contextFor, draft, extraction, filter, pinOrder, pinQuery, stickyKeys],
  );
  const visibility = useMemo(
    () => ({ filter, stickyKeys, visibleKeys: visible.keys }),
    [filter, stickyKeys, visible.keys],
  );

  const activeRef = activeKey ? (refByKey.get(activeKey) ?? null) : null;
  const tabStopKey =
    activeKey && visible.keys.has(activeKey)
      ? activeKey
      : visible.order[0]
        ? rowKeyOf(visible.order[0])
        : null;
  const decisionCounts = countReviewDecisions(draft);
  const sectionCounts = countSectionDecisions(draft);
  const filterCounts = countFilters(extraction, draft, contextFor);
  const groupTasks = tasksApi.tasks.filter((task) => task.groupId === rootId);
  const runningTasks = groupTasks.filter((task) => task.status === "running");
  const runningCount = tasksApi.tasks.filter((task) => task.status === "running").length;
  const isGroupBusy = runningTasks.length > 0;
  const isBaselineUnreviewed = !isRerun && savedCounts.pending > 0;
  const canFinish = mode === "edit" && !isDirty && !unappliedKey && !isBaselineUnreviewed;
  const baselineReviewed = isRerun
    ? submission.comparison?.baseline?.reviewStatus === "reviewed"
    : savedCounts.pending === 0;

  const runAnotherDisabledReason = isDirty
    ? DIRTY_REASON
    : !pdfAvailable
      ? "The PDF wasn't kept for this submission"
      : baselineMissing
        ? "The baseline for this run was deleted"
        : runningCount >= 3
          ? "3 model runs are already in progress"
          : null;

  /* ------------------------------ Datasheet -------------------------------- */

  const embedPane = isXl && !isCoarse;
  const sheetAllowed = isMd && !isXl && !isCoarse;
  const paneOpen =
    pdfViewer.status === "unavailable" ? (paneOverride ?? false) : (paneOverride ?? paneOpenPreference);
  const showPane = embedPane && paneOpen;
  const viewer = usePdfViewer({
    active: showPane || sheetOpen,
    initial: pdfViewer,
    services,
    submissionId,
  });
  const packageRef: ReviewRowRef = { kind: "package" };
  const [pdfContext, setPdfContext] = useState<PdfContext & { key: string | null }>(() => {
    const initialRef = activeKey ? (refByKey.get(activeKey) ?? packageRef) : packageRef;
    const pages = getRowEvidencePages(extraction, initialRef);

    return {
      index: pages.length > 0 ? 0 : -1,
      key: rowKeyOf(initialRef),
      label: describeRowShort(extraction, initialRef),
      pages,
    };
  });
  const [pdfPage, setPdfPage] = useState<number | null>(() => pdfContext.pages[0] ?? null);

  // A #row-… deep link: activate that row (showing every row if a filter
  // hides it) and open the datasheet at its page. Adjusted during render, not
  // in an effect.
  if (hashKey && !hashApplied) {
    const hashRef = refByKey.get(hashKey);
    const pages = hashRef ? getRowEvidencePages(extraction, hashRef) : [];

    setHashApplied(true);
    setActiveKey(hashKey);

    if (!visible.keys.has(hashKey)) {
      setFilterState("all");
      setStickyKeys(EMPTY_KEYS);
    }

    if (hashRef && pages.length > 0) {
      setPdfContext({ index: 0, key: hashKey, label: describeRowShort(extraction, hashRef), pages });
      setPdfPage(pages[0]);
    }
  }
  const revisionNote =
    viewer.state.status === "ready" && viewer.state.viewer.revision === "latest-copy" ? (
      <>
        Cached copy from{" "}
        {viewer.state.viewer.cachedAt ? <LocalDate iso={viewer.state.viewer.cachedAt} /> : "an earlier visit"}
        ; the site may have changed it since this extraction.
      </>
    ) : null;
  const activePage = activeRef ? (getRowEvidencePages(extraction, activeRef)[0] ?? null) : pdfPage;
  const newTabHref = services.pdfTabHref(submissionId, pdfPage, pdfAvailable);

  /* ------------------------------- Helpers --------------------------------- */

  function rowContext(ref: ReviewRowRef, page?: number): PdfContext & { key: string } {
    const pages = getRowEvidencePages(extraction, ref);
    const index = page === undefined ? (pages.length > 0 ? 0 : -1) : pages.indexOf(page);

    return { index, key: rowKeyOf(ref), label: describeRowShort(extraction, ref), pages };
  }

  function setShownPage(page: number | null, immediate: boolean) {
    if (followTimerRef.current !== null) {
      window.clearTimeout(followTimerRef.current);
      followTimerRef.current = null;
    }

    viewer.ensureFresh();

    if (immediate) {
      setPdfPage(page);
    } else {
      followTimerRef.current = window.setTimeout(() => {
        followTimerRef.current = null;
        setPdfPage(page);
      }, 250);
    }
  }

  function focusRow(ref: ReviewRowRef) {
    focusElement(document.getElementById(rowDomId(ref)));
  }

  /** Make a row active. Idempotent: rows call it from both click and focus. */
  function activate(ref: ReviewRowRef, options: { focus?: boolean } = {}) {
    const key = rowKeyOf(ref);

    if (key !== activeKey) {
      setActiveKey(key);

      if (follow && embedPane) {
        const context = rowContext(ref);

        if (context.pages.length > 0) {
          setPdfContext(context);
          setShownPage(context.pages[0], false);
        }
      }
    }

    if (options.focus) {
      focusRow(ref);
    }
  }

  function setFilter(next: ReviewFilter) {
    setFilterState(next);
    setStickyKeys(EMPTY_KEYS);
  }

  /**
   * "Show all" in a section the filter emptied: back to All, then focus that
   * section's first row, because the button is gone once the rows are back.
   */
  function showAllRows(section: FilteredSection) {
    const kind = SECTION_ROW_KIND[section];
    const first = computeVisibleRows({ extraction, filter: "all", pinOrder, pinQuery, review: draft })
      .order.find((ref) => ref.kind === kind);

    setFilter("all");

    if (first) {
      window.requestAnimationFrame(() => activate(first, { focus: true }));
    }
  }

  function setPinQuery(next: string) {
    setPinQueryState(next);
    setStickyKeys(EMPTY_KEYS);
  }

  /** Rows decided while a filter or search excludes them stay visible (§5.3). */
  function markSticky(keys: readonly string[]) {
    if (filter === "all" && pinQuery.trim() === "") {
      return;
    }

    setStickyKeys((current) => new Set([...current, ...keys]));
  }

  function closeEditor() {
    setEditingKey(null);
    setUnappliedKey(null);
  }

  function advanceFrom(ref: ReviewRowRef, nextDraft: typeof draft) {
    const next = findNextPendingRow(nextDraft, visible.order, ref);

    if (next) {
      activate(next, { focus: true });
    } else {
      focusRow(ref);
    }
  }

  function showReadOnlyHint() {
    if (readHintShownRef.current) {
      return;
    }

    readHintShownRef.current = true;
    toast.show({ id: "review-read-hint", title: "Press E to edit this review" });
  }

  function goToUnapplied() {
    const ref = unappliedKey ? refByKey.get(unappliedKey) : null;

    if (!ref) {
      return;
    }

    const input = document.getElementById(correctionInputDomId(ref));

    if (input) {
      input.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }
  }

  function openPdf(page: number | null, context: PdfContext & { key: string | null }) {
    if (embedPane) {
      if (!paneOpen) {
        openPane();
      }

      setPdfContext(context);
      setShownPage(page, true);
      return;
    }

    if (sheetAllowed) {
      setPdfContext(context);
      setShownPage(page, true);
      setSheetOpen(true);
      return;
    }

    const href = services.pdfTabHref(submissionId, page, pdfAvailable);

    if (href) {
      window.open(href, "_blank", "noopener");
    } else {
      toast.show({ title: "The PDF wasn't kept for this submission" });
    }
  }

  function openPane() {
    if (pdfViewer.status === "unavailable") {
      setPaneOverride(true);
    } else {
      setPaneOverride(null);
      setPaneOpenPreference(true);
    }
  }

  function collapsePane() {
    if (pdfViewer.status === "unavailable") {
      setPaneOverride(false);
    } else {
      setPaneOverride(null);
      setPaneOpenPreference(false);
    }
  }

  /**
   * The toolbar "Datasheet" and pane "Hide datasheet" buttons unmount when
   * they toggle the pane, so focus moves to the control that replaces them
   * (or the active row). openPdf (P, evidence chips) opens the pane without
   * this and keeps focus where it is.
   */
  function togglePaneFromButton(open: boolean) {
    paneFocusTargetRef.current = open ? DATASHEET_HIDE_BUTTON_ID : DATASHEET_OPEN_BUTTON_ID;

    if (open) {
      openPane();
    } else {
      collapsePane();
    }
  }

  function stepContextPage(direction: 1 | -1) {
    const { pages } = pdfContext;

    if (pages.length < 2) {
      return;
    }

    const index =
      pdfContext.index < 0
        ? direction === 1
          ? 0
          : pages.length - 1
        : (pdfContext.index + direction + pages.length) % pages.length;

    setPdfContext({ ...pdfContext, index });
    setShownPage(pages[index], true);
  }

  function stepActivePage(direction: 1 | -1) {
    const ref = activeRef ?? packageRef;
    const context = rowContext(ref);

    if (context.pages.length === 0 || (!embedPane && !sheetAllowed)) {
      return;
    }

    const currentIndex = pdfContext.key === context.key ? pdfContext.index : -1;
    const index =
      currentIndex < 0
        ? direction === 1
          ? Math.min(1, context.pages.length - 1)
          : context.pages.length - 1
        : (currentIndex + direction + context.pages.length) % context.pages.length;

    openPdf(context.pages[index], { ...context, index });
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  /* ------------------------------ Decisions -------------------------------- */

  function decide(ref: ReviewRowRef, status: "confirmed" | "pending", options: { advance: boolean }) {
    if (mode !== "edit") {
      showReadOnlyHint();
      return;
    }

    const key = rowKeyOf(ref);
    const next = setDecision(draft, ref, status);

    draftApi.commit(next);

    if (editingKey === key) {
      closeEditor();
    }

    markSticky([key]);

    if (options.advance && autoAdvance && status === "confirmed") {
      advanceFrom(ref, next);
    }
  }

  function openCorrection(ref: ReviewRowRef) {
    if (mode !== "edit") {
      showReadOnlyHint();
      return;
    }

    const key = rowKeyOf(ref);

    if (unappliedKey && unappliedKey !== key) {
      toast.show({
        id: SAVE_BLOCKED_TOAST_ID,
        title: "Apply or cancel the open correction first",
        tone: "warning",
      });
      goToUnapplied();
      return;
    }

    activate(ref);
    setEditingKey(key);
  }

  function applyCorrectionTo(ref: ReviewRowRef, input: CorrectionInput, advance: boolean) {
    const next = applyCorrection(extraction, draft, ref, input);

    draftApi.commit(next);
    closeEditor();
    markSticky([rowKeyOf(ref)]);

    if (advance) {
      advanceFrom(ref, next);
    } else {
      window.requestAnimationFrame(() => focusRow(ref));
    }
  }

  function bulk(refs: readonly ReviewRowRef[], noun: (count: number) => string) {
    if (mode !== "edit") {
      return;
    }

    const changedRefs = listBulkConfirmChanges(draft, refs);
    const result = bulkConfirm(draft, refs);

    if (result.changed === 0) {
      return;
    }

    draftApi.commit(result.review);
    markSticky(refs.map(rowKeyOf));
    toast.show({
      action: {
        label: "Undo",
        // Only the rows this action confirmed go back to pending; edits made
        // since stay. Never in read mode (the toast is also dismissed on Done
        // and Discard; the ref guards a click that races them).
        onClick: () => {
          if (modeRef.current === "edit") {
            draftApi.update((current) => revertBulkConfirm(current, changedRefs));
          }
        },
      },
      durationMs: 8000,
      id: BULK_UNDO_TOAST_ID,
      title: `Confirmed ${noun(result.changed)}`,
      tone: "success",
    });
  }

  const latestCallbacks: ReviewRowCallbacks = {
    onActivate: (ref) => activate(ref),
    onApplyCorrection: (ref, input, options) => applyCorrectionTo(ref, input, options.advance),
    onBulkConfirm: (refs, scope: BulkConfirmScope) =>
      bulk(refs, (count) => pluralize(count, scope.kind === "measurements" ? "measurement" : "pin")),
    onCloseCorrection: (ref) => {
      closeEditor();
      window.requestAnimationFrame(() => focusRow(ref));
    },
    onCorrectionDraftChange: (ref, hasUnappliedInput) => {
      const key = rowKeyOf(ref);

      setUnappliedKey((current) => (hasUnappliedInput ? key : current === key ? null : current));
    },
    onDecide: (ref, status) => decide(ref, status, { advance: false }),
    onOpenCorrection: openCorrection,
    onRemoveCorrection: (ref) => {
      draftApi.commit(setDecision(draft, ref, "pending"));
      closeEditor();
      window.requestAnimationFrame(() => focusRow(ref));
    },
    onShowAll: showAllRows,
    onShowPage: (page, ref) =>
      openPdf(page, ref ? rowContext(ref, page) : { index: 0, key: null, label: null, pages: [page] }),
  };
  const callbacksRef = useRef(latestCallbacks);

  useLayoutEffect(() => {
    callbacksRef.current = latestCallbacks;
  });

  // One object for the life of the workspace, forwarding to the latest
  // handlers: the memoised pin rows then re-render only when their own props
  // change, not on every keypress (see ReviewRowCallbacks).
  const [callbacks] = useState<ReviewRowCallbacks>(() => ({
    onActivate: (ref) => callbacksRef.current.onActivate(ref),
    onApplyCorrection: (ref, input, options) =>
      callbacksRef.current.onApplyCorrection(ref, input, options),
    onBulkConfirm: (refs, scope) => callbacksRef.current.onBulkConfirm(refs, scope),
    onCloseCorrection: (ref) => callbacksRef.current.onCloseCorrection(ref),
    onCorrectionDraftChange: (ref, hasUnappliedInput) =>
      callbacksRef.current.onCorrectionDraftChange?.(ref, hasUnappliedInput),
    onDecide: (ref, status) => callbacksRef.current.onDecide(ref, status),
    onOpenCorrection: (ref) => callbacksRef.current.onOpenCorrection(ref),
    onRemoveCorrection: (ref) => callbacksRef.current.onRemoveCorrection(ref),
    onShowAll: (section) => callbacksRef.current.onShowAll(section),
    onShowPage: (page, ref) => callbacksRef.current.onShowPage(page, ref),
  }));

  /* ------------------------------ Navigation ------------------------------- */

  function move(direction: 1 | -1) {
    const order = visible.order;

    if (order.length === 0) {
      return;
    }

    const index = activeKey ? order.findIndex((ref) => rowKeyOf(ref) === activeKey) : -1;
    const nextIndex =
      index === -1
        ? direction === 1
          ? 0
          : order.length - 1
        : Math.min(order.length - 1, Math.max(0, index + direction));

    activate(order[nextIndex], { focus: true });
  }

  function goToNextPending(direction: 1 | -1 = 1) {
    const next = findNextPendingRow(draft, visible.order, activeRef, { direction });

    if (next) {
      activate(next, { focus: true });
    } else if (decisionCounts.pending > 0) {
      toast.show({ id: "review-next-hint", title: "No pending rows in this view" });
    } else {
      toast.show({ id: "review-next-hint", title: "Every row is decided" });
    }
  }

  /* -------------------------------- Modes ---------------------------------- */

  function enterEdit() {
    setMode("edit");

    if (!isRerun && rerunCount > 0 && !runsNoticeShownRef.current) {
      runsNoticeShownRef.current = true;
      toast.show({
        durationMs: 8000,
        title: `Changing this review updates agreement for ${pluralize(rerunCount, "run")}.`,
      });
    }

    const target = activeRef && visible.keys.has(rowKeyOf(activeRef)) ? activeRef : visible.order[0];

    if (target) {
      window.requestAnimationFrame(() => activate(target, { focus: true }));
    }
  }

  function finishEditing() {
    closeEditor();
    // Read mode never changes the draft: no ⌘Z into this session, no bulk Undo.
    draftApi.clearHistory();
    toast.dismiss(BULK_UNDO_TOAST_ID);
    setMode("read");
    window.requestAnimationFrame(() => {
      focusFirstVisible(["review-action-edit", "review-mobile-edit"]);
    });
  }

  /* --------------------------------- Save ---------------------------------- */

  async function handleSave() {
    if (unappliedKey) {
      toast.show({
        id: SAVE_BLOCKED_TOAST_ID,
        title: "Apply or cancel the open correction first",
        tone: "warning",
      });
      goToUnapplied();
      return;
    }

    if (!draftApi.isDirty || draftApi.isSaving) {
      return;
    }

    // No try/catch here: the React Compiler bails out on conditionals inside
    // try blocks, which would leave the whole workspace unmemoised.
    const result = await draftApi.save().then(
      (outcome) => ({ error: null, outcome }),
      (error: unknown) => ({ error: error ?? new Error("Save failed"), outcome: null }),
    );

    if (result.error !== null) {
      showSaveFailed(result.error);
      return;
    }

    const outcome = result.outcome;

    if (!outcome) {
      return;
    }

    closeEditor();
    setDiscardOpen(false);
    // The undo stack is cleared on save, so a pending bulk Undo goes too.
    toast.dismiss(BULK_UNDO_TOAST_ID);
    toast.dismiss("review-save-failed");
    startTransition(() => router.refresh());

    const savedReview = outcome.submission.review;
    const counts = countReviewDecisions(savedReview);

    if (outcome.justCompleted) {
      const summary = describeCompletion(savedReview);

      setCompletion({ summary: summary.summary, title: `${partNumber} reviewed` });
      toast.show({
        title:
          summary.accuracy === null
            ? `${partNumber} reviewed`
            : `${partNumber} reviewed · ${summary.accuracy}% accurate`,
        tone: "success",
      });
      window.requestAnimationFrame(() => {
        document.getElementById(COMPLETION_CARD_ID)?.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "nearest",
        });
      });
    } else {
      // Keep the card only while the saved review is still fully decided,
      // with its summary recomputed from what was just saved.
      setCompletion((current) => refreshCompletion(current, savedReview));
      toast.show({
        title: `Review saved · ${counts.total - counts.pending} of ${counts.total} decided`,
        tone: "success",
      });
    }

    window.requestAnimationFrame(() => {
      if (!focusFirstVisible(["review-action-done", "review-mobile-done"]) && activeRef) {
        focusRow(activeRef);
      }
    });
  }

  function showSaveFailed(error: unknown) {
    toast.show({
      action: { label: "Retry", onClick: () => saveRef.current() },
      description: error instanceof Error ? error.message : "Check your connection and try again.",
      durationMs: 0,
      id: "review-save-failed",
      title: "Couldn't save the review",
      tone: "danger",
    });
  }

  const saveRef = useRef(handleSave);

  useEffect(() => {
    saveRef.current = handleSave;
  });

  function confirmDiscard() {
    // The saved review is about to change; Discard waits for the save.
    if (draftApi.isSaving) {
      return;
    }

    draftApi.discard();
    // Nothing from the discarded session can come back through the bulk Undo.
    toast.dismiss(BULK_UNDO_TOAST_ID);
    closeEditor();
    setDiscardOpen(false);
    window.requestAnimationFrame(() => {
      const target = activeRef ?? visible.order[0];

      if (target) {
        activate(target, { focus: true });
      }
    });
  }

  /* --------------------------------- Runs ---------------------------------- */

  function openRerunDialog() {
    if (runAnotherDisabledReason) {
      toast.show({ title: runAnotherDisabledReason });
      return;
    }

    setRerunOpen(true);
  }

  function startRerun(settings: RerunSettings) {
    setRerunOpen(false);

    const label = formatRunLabel(settings);
    const modelName = formatModelName(settings.model);
    const taskId = tasksApi.startTask<SubmissionDetail>({
      groupId: rootId,
      kind: "rerun",
      label,
      // Every attempt shares this input; the provider passes the id of the
      // attempt that failed, so Retry always targets the live task.
      onError: (error, { taskId: failedTaskId }) => ({
        action: { label: "Retry", onClick: () => retryTask(failedTaskId) },
        description: error instanceof Error ? error.message : undefined,
        durationMs: 10000,
        title: `${modelName} run failed`,
        tone: "danger",
      }),
      onSuccess: (result) => {
        const outcome = describeRunAgreement(result.comparison?.agreement);
        const href = services.hrefFor(result.submissionId);

        return {
          href,
          toast: {
            action: { href, label: "Open run" },
            description: outcome.scored ? undefined : (outcome.text ?? undefined),
            durationMs: 8000,
            title: outcome.scored
              ? `${modelName} finished · ${Math.round(outcome.value ?? 0)}% agreement`
              : `${modelName} finished`,
            tone: "success",
          },
        };
      },
      run: (signal) => services.rerun(rootId, settings, signal),
    });

    if (taskId === null) {
      toast.show({
        description: "Wait for one to finish, then try again.",
        title: "3 model runs are already in progress",
        tone: "warning",
      });
      return;
    }

    toast.show({
      description: "Keep reviewing. We'll let you know when it finishes.",
      title: `Running ${label}`,
    });
  }

  function retryTask(id: string) {
    if (!tasksApi.retry(id)) {
      toast.show({
        description: "Wait for a run to finish, or start one from Run another model.",
        title: "Couldn't retry this run",
        tone: "warning",
      });
    }
  }

  /* ------------------------------- Keyboard -------------------------------- */

  useReviewKeyboard(rootRef, {
    confirm: () => {
      if (!activeRef) {
        move(1);
        return;
      }

      decide(activeRef, "confirmed", { advance: true });
    },
    enterEdit,
    escape: (target) => {
      if (target instanceof HTMLInputElement && target.id === PIN_SEARCH_INPUT_ID) {
        target.blur();

        if (activeRef) {
          focusRow(activeRef);
        }

        return true;
      }

      return false;
    },
    incorrect: () => {
      if (activeRef) {
        openCorrection(activeRef);
      }
    },
    mode,
    move,
    nextPending: goToNextPending,
    openShortcuts: () => setShortcutsOpen(true),
    pending: () => {
      if (activeRef) {
        decide(activeRef, "pending", { advance: false });
      }
    },
    readOnlyHint: showReadOnlyHint,
    save: () => void handleSave(),
    showPdf: () => {
      const ref = activeRef ?? packageRef;
      const context = rowContext(ref);

      openPdf(context.pages[0] ?? pdfPage, context);
    },
    singleKeyShortcuts,
    stepPage: stepActivePage,
    undo: () => {
      // Read mode never changes the draft.
      if (mode !== "edit") {
        showReadOnlyHint();
        return;
      }

      if (!draftApi.undo()) {
        toast.show({ id: "review-undo-empty", title: "Nothing to undo" });
      }
    },
  });

  /* ------------------------------- Effects --------------------------------- */

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const focusAfterPaneToggle = useEffectEvent(() => {
    const id = paneFocusTargetRef.current;

    if (!id) {
      return;
    }

    paneFocusTargetRef.current = null;

    if (!focusFirstVisible([id]) && activeRef) {
      focusRow(activeRef);
    }
  });

  useEffect(() => {
    focusAfterPaneToggle();
  }, [showPane]);

  // A pending follow-selection jump must not fire after the page is gone.
  useEffect(() => {
    const timers = followTimerRef;

    return () => {
      if (timers.current !== null) {
        window.clearTimeout(timers.current);
      }
    };
  }, []);

  const focusAfterMount = useEffectEvent(() => {
    if (activeRef) {
      focusRow(activeRef);
    }
  });

  // Arrival from the intake, or a #row-… deep link: focus the active row.
  useEffect(() => {
    if (arrived || hashApplied) {
      focusAfterMount();
    }
  }, [arrived, hashApplied]);

  const activeSectionId = useScrollSpy([
    REVIEW_SECTION_IDS.package,
    REVIEW_SECTION_IDS.measurements,
    ...(extraction.pinRows.length > 0 ? [REVIEW_SECTION_IDS.pins] : []),
    REVIEW_SECTION_IDS.notes,
    REVIEW_SECTION_IDS.runs,
  ]);

  /* -------------------------------- Labels --------------------------------- */

  const progress = deriveReviewProgress(savedCounts);
  const rerunStatus: ReviewStatusRerun | null = isRerun
    ? {
        agreementPercentage: agreement?.agreementPercentage ?? null,
        basis: agreement?.basis ?? null,
        baselineMissing,
        baselineReviewedDecisions: agreement?.baselineReviewedDecisions ?? null,
        baselineTotalDecisions: agreement?.baselineTotalDecisions ?? null,
        isScored: isScoredAgreement(agreement),
      }
    : null;
  const modelWithEffort = formatModelWithEffort(submission.providerMeta);
  const baselineStatusText = baselineRun
    ? baselineRun.reviewProgress.state === "reviewed"
      ? "Reviewed"
      : baselineRun.reviewProgress.state === "inProgress"
        ? "In review"
        : "Not started"
    : null;
  const metaParts = isRerun
    ? [
        submission.comparison?.baseline
          ? `Re-run of ${partNumber} baseline${
              baselineRun ? ` (${formatRunLabel(baselineRun.providerMeta)} · ${baselineStatusText})` : ""
            }`
          : "Re-run of a deleted baseline",
        modelWithEffort,
      ]
    : [intake.packageCategory, source.host ?? source.fileName, modelWithEffort];
  const metaTitle = metaParts.join(" · ");
  const meta = (
    <>
      {metaTitle} · <RelativeTime iso={submission.createdAt} />
    </>
  );
  const runAgreement = describeRunAgreement(agreement);
  const switcherLabel = isRerun
    ? `${formatModelDotEffort(submission.providerMeta)}${runAgreement.scored ? ` · ${Math.round(runAgreement.value ?? 0)}%` : ""}`
    : `${formatModelName(submission.providerMeta.model)} · Baseline${rerunCount > 0 ? ` · ${pluralize(rerunCount, "run")}` : ""}`;
  const switcherCompactLabel = isRerun
    ? `${formatRunLabel(submission.providerMeta)}${runAgreement.scored ? ` · ${Math.round(runAgreement.value ?? 0)}%` : ""}`
    : `Baseline${rerunCount > 0 ? ` · ${pluralize(rerunCount, "run")}` : ""}`;
  const reportsHref = `/reports?datasheet=${encodeURIComponent(rootId)}#matrix`;
  const baselineHref = submission.comparison?.baseline ? services.hrefFor(rootId) : null;
  const deleteTarget: DeleteSubmissionTarget = isRerun
    ? {
        baselineSubmissionId: submission.comparison?.baseline ? rootId : null,
        kind: "rerun",
        model: submission.providerMeta.model,
        submissionId,
      }
    : { kind: "baseline", partNumber, runCount: rerunCount, submissionId };
  const deleteDisabledReason = !services.canDelete
    ? "Not available in the preview"
    : isDirty
      ? DIRTY_REASON
      : isGroupBusy
        ? RUN_IN_PROGRESS_REASON
        : null;
  const mobilePdfHref = services.pdfTabHref(submissionId, activePage, pdfAvailable);

  // A promise chain, not try/catch, so the React Compiler can compile the workspace.
  function copyLink() {
    const url = new URL(services.hrefFor(submissionId), window.location.origin).toString();

    return Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(
        () => toast.show({ title: "Link copied", tone: "success" }),
        () => toast.show({ title: "Couldn't copy the link", tone: "danger" }),
      );
  }

  const pdfTabHref = services.pdfTabHref(submissionId, activePage, pdfAvailable);
  const baseMenu: MenuEntry[] = [
    pdfTabHref
      ? { external: true, href: pdfTabHref, icon: <FileText />, label: "Open PDF in new tab" }
      : {
          disabled: true,
          disabledReason: "The PDF wasn't kept for this submission",
          icon: <FileText />,
          label: "Open PDF in new tab",
        },
    ...(source.kind === "url" && source.originalUrl
      ? [{ external: true, href: source.originalUrl, icon: <Globe />, label: "Open original link" }]
      : services.pdfDownloadHref(submissionId, pdfAvailable)
        ? [
            {
              external: true,
              href: services.pdfDownloadHref(submissionId, pdfAvailable) as string,
              icon: <Download />,
              label: "Download PDF",
            },
          ]
        : []),
    { icon: <Link2 />, label: "Copy link", onSelect: () => void copyLink() },
    {
      disabled: Boolean(runAnotherDisabledReason),
      disabledReason: runAnotherDisabledReason ?? undefined,
      icon: <Play />,
      label: "Run another model…",
      onSelect: openRerunDialog,
    },
    {
      icon: <Keyboard />,
      label: "Keyboard shortcuts",
      onSelect: () => setShortcutsOpen(true),
      shortcut: "?",
    },
    "separator",
    {
      disabled: Boolean(deleteDisabledReason),
      disabledReason: deleteDisabledReason ?? undefined,
      icon: <Trash2 />,
      label: "Delete submission…",
      onSelect: () => setDeleteOpen(true),
      tone: "danger",
    },
  ];
  const mobileMenu: MenuEntry[] = [
    { icon: <Info />, label: "Details", onSelect: () => setDetailsOpen(true) },
    { icon: <Rows3 />, label: "Runs", onSelect: () => setRunSheetOpen(true) },
    ...(isDirty
      ? [
          {
            disabled: draftApi.isSaving,
            disabledReason: draftApi.isSaving ? "Saving…" : undefined,
            icon: <Undo2 />,
            label: "Discard changes…",
            onSelect: () => setDiscardOpen(true),
          },
        ]
      : []),
    "separator",
    ...baseMenu.filter(
      (entry) => entry === "separator" || entry.label !== "Keyboard shortcuts",
    ),
  ];

  const sections: ToolbarSection[] = [
    {
      count: sectionCounts.package.pending,
      done: sectionCounts.package.total > 0 && sectionCounts.package.pending === 0,
      id: REVIEW_SECTION_IDS.package,
      label: "Package",
    },
    {
      count: sectionCounts.measurements.pending,
      done: sectionCounts.measurements.total > 0 && sectionCounts.measurements.pending === 0,
      id: REVIEW_SECTION_IDS.measurements,
      label: "Measurements",
    },
    ...(extraction.pinRows.length > 0
      ? [
          {
            count: sectionCounts.pins.pending,
            done: sectionCounts.pins.pending === 0,
            id: REVIEW_SECTION_IDS.pins,
            label: "Pins",
          },
        ]
      : []),
    { count: null, done: false, id: REVIEW_SECTION_IDS.notes, label: "Notes" },
    {
      count: rerunCount > 0 ? rerunCount : null,
      done: false,
      id: REVIEW_SECTION_IDS.runs,
      label: "Runs",
      neutralCount: true,
    },
  ];
  const filterOptions: Array<{ count: number; value: ReviewFilter }> = [
    { count: filterCounts.all, value: "all" },
    { count: filterCounts.pending, value: "pending" },
    { count: filterCounts.attention, value: "attention" },
    { count: filterCounts.incorrect, value: "incorrect" },
    ...(isRerun ? [{ count: filterCounts.differs, value: "differs" as const }] : []),
    ...(!isRerun && rerunCount > 0
      ? [{ count: filterCounts.runsDisagree, value: "runsDisagree" as const }]
      : []),
  ];
  const toolbarProgress = {
    confirmed: decisionCounts.confirmed,
    corrected: decisionCounts.corrected,
    pending: decisionCounts.pending,
    total: decisionCounts.total,
  };
  const editLabel = isRerun ? "Review this run" : "Edit review";
  const firstRunning = runningTasks[0] ?? null;
  const runningChip = firstRunning ? (
    <button
      aria-label={`${firstRunning.label} is running. Show runs`}
      className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs bg-accent-soft px-2 text-caption font-medium text-accent-text transition-colors duration-(--ui-duration-fast) ease-ui hover:bg-surface-selected pointer-coarse:min-h-11"
      onClick={() => {
        if (isMobile) {
          setRunSheetOpen(true);
        } else {
          runSwitcherTriggerRef.current?.click();
        }
      }}
      type="button"
    >
      <Spinner size={12} />
      <span className="max-xl:hidden">Running {shortTaskName(firstRunning.label)} ·</span>
      <ElapsedTime startedAt={firstRunning.startedAt} />
      {runningTasks.length > 1 ? <span className="text-accent-text/80">+{runningTasks.length - 1}</span> : null}
    </button>
  ) : null;

  const unappliedLink = unappliedKey ? (
    <button
      className="inline-flex items-center gap-1 rounded-xs text-callout font-medium whitespace-nowrap text-warning underline-offset-2 hover:underline pointer-coarse:min-h-11"
      onClick={goToUnapplied}
      type="button"
    >
      1 correction not applied · Go to
    </button>
  ) : null;
  const saveCount = (
    <span className="rounded-xs bg-white/20 px-1.5 text-caption tabular-nums">
      {draftApi.changedCount}
      <span className="sr-only"> {draftApi.changedCount === 1 ? "change" : "changes"}</span>
    </span>
  );

  const headerActions =
    mode === "read" ? (
      <Tooltip
        content={
          <span className="inline-flex items-center gap-2">
            {editLabel}
            <Kbd>E</Kbd>
          </span>
        }
        describeChild={false}
      >
        <Button aria-keyshortcuts="E" id="review-action-edit" onClick={enterEdit} size="sm" variant="secondary">
          {editLabel}
        </Button>
      </Tooltip>
    ) : (
      <>
        {unappliedLink}
        {isDirty ? (
          <>
            <Button
              disabled={draftApi.isSaving}
              onClick={() => setDiscardOpen(true)}
              size="sm"
              variant="ghost"
            >
              Discard
            </Button>
            <Tooltip
              content={
                <span className="inline-flex items-center gap-2">
                  Save review
                  <Kbd>⌘S</Kbd>
                </span>
              }
              describeChild={false}
            >
              <Button
                aria-keyshortcuts="Meta+S Control+S"
                disabled={Boolean(unappliedKey)}
                id="review-action-save"
                loading={draftApi.isSaving}
                onClick={() => void handleSave()}
                size="sm"
                variant="primary"
              >
                {draftApi.isSaving ? (
                  "Saving…"
                ) : (
                  <>
                    Save<span className="max-xl:sr-only"> review</span>
                  </>
                )}
                {draftApi.isSaving ? null : saveCount}
              </Button>
            </Tooltip>
          </>
        ) : (
          // One cell holding an invisible copy of the read-mode button, so the
          // slot keeps its width and the run switcher and menu never move
          // between Edit review / Review this run and Done.
          <span className="grid justify-items-end">
            <Button
              aria-hidden="true"
              className="invisible col-start-1 row-start-1"
              size="sm"
              tabIndex={-1}
              variant="secondary"
            >
              {editLabel}
            </Button>
            {canFinish ? (
              <Button
                className="col-start-1 row-start-1"
                id="review-action-done"
                onClick={finishEditing}
                size="sm"
                variant="ghost"
              >
                Done
              </Button>
            ) : null}
          </span>
        )}
      </>
    );

  const mobileAction =
    mode === "read" ? (
      <Button id="review-mobile-edit" onClick={enterEdit} variant="secondary">
        {editLabel}
      </Button>
    ) : unappliedKey ? (
      unappliedLink
    ) : isDirty ? (
      <Button
        id="review-mobile-save"
        loading={draftApi.isSaving}
        onClick={() => void handleSave()}
        variant="primary"
      >
        {draftApi.isSaving ? "Saving…" : "Save"}
        {draftApi.isSaving ? null : saveCount}
      </Button>
    ) : canFinish ? (
      <Button id="review-mobile-done" onClick={finishEditing} variant="ghost">
        Done
      </Button>
    ) : null;

  const listProps = {
    activeKey,
    callbacks,
    comparison,
    editingKey,
    extraction,
    mode,
    pdfAvailable,
    review: draft,
    runHints,
    tabStopKey,
    visibility,
  };
  const switcherListProps = {
    currentSubmissionId: submissionId,
    hrefFor: services.hrefFor,
    onRetryTask: retryTask,
    onRunAnotherModel: openRerunDialog,
    reportsHref,
    runAnotherDisabledReason,
    runs,
    tasks: groupTasks,
  };
  const showArrival = arrived && !arrivalDismissed;
  const arrivalStats = showArrival ? computeArrivalStats(submission) : null;
  const pendingMirror = draftApi.mirror.pending;
  const hasAiNotes =
    extraction.review.needsReview || extraction.review.notes.some((note) => note.trim().length > 0);
  const hasTopContent = Boolean(arrivalStats || pendingMirror || completion || hasAiNotes || isRerun);

  /* -------------------------------- Render --------------------------------- */

  return (
    <div
      className="relative min-w-0 max-md:[--ui-header-height:52px] max-md:[--ui-toolbar-height:44px]"
      data-review-workspace=""
      ref={rootRef}
    >
      {isMobile ? (
        <style>{`:root{--ui-toast-offset:calc(56px + 16px)}html{scroll-padding-bottom:calc(56px + 24px + env(safe-area-inset-bottom))}`}</style>
      ) : null}

      <ReviewHeader
        actions={headerActions}
        backHref={backHref}
        datasheetButton={
          sheetAllowed
            ? {
                onClick: () => {
                  const ref = activeRef ?? packageRef;
                  const context = rowContext(ref);

                  openPdf(context.pages[0] ?? pdfPage, context);
                },
              }
            : null
        }
        details={{ baselineHref, revisionNote, submission: saved }}
        isDirty={isDirty}
        menu={{ desktop: baseMenu, mobile: mobileMenu }}
        meta={meta}
        metaTitle={metaTitle}
        mobilePdfHref={mobilePdfHref}
        partNumber={partNumber}
        progress={progress}
        rerun={rerunStatus}
        runSwitcher={
          <RunSwitcher
            {...switcherListProps}
            compactLabel={switcherCompactLabel}
            label={switcherLabel}
            triggerRef={runSwitcherTriggerRef}
          />
        }
        runningChip={runningChip}
      />

      <div
        className={
          showPane
            ? "min-w-0 xl:grid xl:grid-cols-[minmax(0,1fr)_clamp(420px,44%,760px)]"
            : "min-w-0"
        }
      >
        <div className="min-w-0">
          <ReviewToolbar
            activeSectionId={activeSectionId}
            datasheetButton={embedPane && !showPane ? { onClick: () => togglePaneFromButton(true) } : null}
            filter={filter}
            filterOptions={filterOptions}
            onFilterChange={setFilter}
            onNext={() => goToNextPending(1)}
            onProgressClick={() => setFilter("pending")}
            onSectionClick={scrollToSection}
            progress={toolbarProgress}
            sections={sections}
            showBaselineValues={
              isRerun ? { onChange: setShowBaselineValues, value: showBaselineValues } : null
            }
          />

          <div className="mx-auto flex w-full max-w-[840px] flex-col gap-8 px-4 pt-5 pb-28 sm:px-6 md:pt-6 md:pb-16 xl:max-w-(--ui-content-review)">
            <div className="space-y-3 md:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatusBadge progress={progress} rerun={rerunStatus} />
                {runningChip}
              </div>
              <p className="line-clamp-2 text-callout text-text-muted">{meta}</p>
              <Button
                className="h-11! w-full justify-between!"
                onClick={() => setRunSheetOpen(true)}
                variant="secondary"
              >
                <span className="min-w-0 truncate">{switcherLabel}</span>
                <ChevronDown aria-hidden="true" className="text-text-muted" />
              </Button>
            </div>

            {hasTopContent ? (
              <div className="flex flex-col gap-4">
                {arrivalStats ? (
                  <ArrivalBanner
                    onDismiss={() => setArrivalDismissed(true)}
                    onStartWithFlagged={() => {
                      setFilter("attention");
                      setArrivalDismissed(true);
                    }}
                    stats={arrivalStats}
                  />
                ) : null}

                {pendingMirror ? (
                  <RestoreDraftCallout
                    onDiscard={draftApi.mirror.dismiss}
                    onRestore={() => {
                      draftApi.mirror.restore();
                      setMode("edit");
                    }}
                    savedAt={pendingMirror.savedAt}
                  />
                ) : null}

                {completion ? (
                  <CompletionCard
                    allSubmissionsHref={backHref}
                    hrefFor={services.hrefFor}
                    id={COMPLETION_CARD_ID}
                    nextReview={nextReview}
                    onDismiss={() => setCompletion(null)}
                    onRunAnotherModel={openRerunDialog}
                    runAnotherDisabledReason={runAnotherDisabledReason}
                    summary={completion.summary}
                    title={completion.title}
                  />
                ) : null}

                <AiNotesCallout
                  expanded={notesExpanded}
                  onExpandedChange={setNotesExpandedChoice}
                  onShowPage={
                    pdfAvailable
                      ? (page) => openPdf(page, { index: 0, key: null, label: null, pages: [page] })
                      : undefined
                  }
                  summary={extraction.review}
                />

                {isRerun ? (
                  <AgreementSummary
                    agreement={agreement}
                    baselineHref={baselineHref}
                    baselineLabel={baselineRun ? formatRunLabel(baselineRun.providerMeta) : null}
                    baselineMissing={baselineMissing}
                    matchingPendingRefs={listMatchingPendingRefs(agreement, extraction, draft)}
                    mode={mode}
                    onConfirmMatching={(refs) => bulk(refs, (count) => pluralize(count, "row"))}
                    onlyInBaselineLabels={listOnlyInBaselineRows(agreement, extraction).map(
                      (row) => row.label,
                    )}
                  />
                ) : null}
              </div>
            ) : null}

            <PackageReviewBlock {...listProps} />
            <MeasurementReviewList {...listProps} />
            {extraction.pinRows.length > 0 ? (
              <PinReviewList
                {...listProps}
                search={{
                  onChange: setPinQuery,
                  shortcutKey: singleKeyShortcuts ? "/" : null,
                  value: pinQuery,
                }}
              />
            ) : (
              <PinReviewList {...listProps} />
            )}
            <ReviewerNotesSection
              mode={mode}
              onChange={draftApi.setReviewerNotes}
              value={draft.reviewerNotes}
            />
            <ModelRunsSection
              currentSubmissionId={submissionId}
              hrefFor={services.hrefFor}
              onRunAnotherModel={baselineMissing ? undefined : openRerunDialog}
              reportsHref={reportsHref}
              runAnotherDisabledReason={runAnotherDisabledReason}
              runningRuns={runningTasks.map((task) => ({ id: task.id, label: task.label }))}
              runs={runs}
            />

            <p className="-mt-2 text-caption text-text-muted max-xl:hidden">
              {mode === "edit"
                ? "J / K move · C confirm · X incorrect · N next pending · ? all shortcuts"
                : "J / K move · E edit · P show page · ? all shortcuts"}
            </p>
          </div>
        </div>

        {showPane ? (
          <DatasheetPane
            className="sticky top-(--ui-header-height) hidden h-[calc(100dvh-var(--ui-header-height))] self-start xl:flex"
            context={pdfContext}
            fileName={source.fileName}
            follow={follow}
            newTabHref={newTabHref}
            onCollapse={() => togglePaneFromButton(false)}
            onFollowChange={setFollow}
            onRetry={viewer.retry}
            onStep={stepContextPage}
            originalUrl={viewer.originalUrl}
            page={pdfPage}
            partNumber={partNumber}
            revisionNote={revisionNote}
            state={viewer.state}
          />
        ) : null}
      </div>

      <MobileReviewBar action={mobileAction} onNext={() => goToNextPending(1)} progress={toolbarProgress} />

      <ShortcutsDialog
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={setAutoAdvance}
        onClose={() => setShortcutsOpen(false)}
        onSingleKeyShortcutsChange={setSingleKeyShortcuts}
        open={shortcutsOpen}
        singleKeyShortcuts={singleKeyShortcuts}
      />

      <Dialog
        description="Your review goes back to the last saved version. You can undo this with ⌘Z."
        footer={
          <>
            <Button onClick={() => setDiscardOpen(false)} variant="secondary">
              Keep reviewing
            </Button>
            <Button disabled={draftApi.isSaving} onClick={confirmDiscard} variant="danger">
              Discard
            </Button>
          </>
        }
        onClose={() => setDiscardOpen(false)}
        open={discardOpen}
        role="alertdialog"
        size="sm"
        title={`Discard ${pluralize(draftApi.changedCount, "unsaved change")}?`}
      />

      <RerunDialog
        baselineReviewed={baselineReviewed}
        defaultModel={defaultSettings.model}
        defaultReasoningEffort={defaultSettings.reasoningEffort}
        onClose={() => setRerunOpen(false)}
        onStart={startRerun}
        open={rerunOpen}
        partNumber={partNumber}
        runs={runs}
        variant={isMobile ? "sheet-bottom" : "center"}
      />

      <RunSwitcherSheet {...switcherListProps} onClose={() => setRunSheetOpen(false)} open={runSheetOpen} />

      <Dialog onClose={() => setDetailsOpen(false)} open={detailsOpen} title="Details" variant="sheet-bottom">
        <div className="pb-2">
          <SubmissionDetails baselineHref={baselineHref} revisionNote={revisionNote} submission={saved} />
        </div>
      </Dialog>

      {services.canDelete ? (
        <DeleteSubmissionDialog
          onClose={() => setDeleteOpen(false)}
          open={deleteOpen}
          target={deleteTarget}
        />
      ) : null}

      {sheetAllowed ? (
        <DatasheetSheet
          context={pdfContext}
          fileName={source.fileName}
          newTabHref={newTabHref}
          onClose={() => setSheetOpen(false)}
          onRetry={viewer.retry}
          onStep={stepContextPage}
          open={sheetOpen}
          originalUrl={viewer.originalUrl}
          page={pdfPage}
          partNumber={partNumber}
          revisionNote={revisionNote}
          state={viewer.state}
        />
      ) : null}
    </div>
  );
}
