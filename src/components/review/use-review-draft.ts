"use client";

import { useEffect, useRef, useState } from "react";

import { useNavigationGuard } from "@/components/navigation-blocker-provider";
import {
  countChangedDecisions,
  countReviewDecisions,
  hasReviewerNotesChanged,
  isReviewDraftDirty,
  normalizeSubmissionReview,
} from "@/lib/submissions/review";
import type { SubmissionDetail, SubmissionHumanReview } from "@/lib/submissions/types";

import type { ReviewWorkspaceServices } from "./review-services";
import {
  clearDraftMirrors,
  takeDraftMirror,
  useMountValue,
  writeDraftMirror,
  type DraftMirror,
} from "./review-storage";

/** Undo depth (§5.4). */
const MAX_UNDO = 50;
/** Debounce for the localStorage mirror (addendum S). */
const MIRROR_DEBOUNCE_MS = 500;

type HistoryEntry = {
  review: SubmissionHumanReview;
  /**
   * Undoing a Discard or a restore brings the reviewer notes back too. Every
   * other entry keeps the notes as they are now, because notes are typed
   * without undo entries (the textarea has its own undo).
   */
  restoresNotes: boolean;
};

type DraftState = {
  draft: SubmissionHumanReview;
  past: HistoryEntry[];
  /** Increments on every user change; 0 means untouched since mount. */
  version: number;
};

export type SaveOutcome = {
  /** Pending reached 0 with this save, after being above 0 before it. */
  justCompleted: boolean;
  submission: SubmissionDetail;
};

export type CommitOptions = {
  /** "discard" and "restore" entries also bring the notes back on undo. */
  kind?: "change" | "discard" | "restore";
};

export type ReviewDraftApi = {
  /** Number of changed rows, plus 1 when the reviewer notes changed. */
  changedCount: number;
  canUndo: boolean;
  /**
   * Drops the undo stack (Done: leaving edit mode with a clean draft), so a
   * later ⌘Z never reaches into an earlier editing session.
   */
  clearHistory: () => void;
  /** Replaces the draft and pushes an undo entry. */
  commit: (next: SubmissionHumanReview, options?: CommitOptions) => void;
  /**
   * Back to the last saved review (undoable with ⌘Z). Clears the mirror.
   * Does nothing while a save is in flight (the saved review is about to change).
   */
  discard: () => void;
  draft: SubmissionHumanReview;
  isDirty: boolean;
  isSaving: boolean;
  /** Unsaved work found in localStorage for this saved version (addendum S). */
  mirror: {
    dismiss: () => void;
    pending: DraftMirror | null;
    restore: () => void;
  };
  /**
   * Replaces the draft with `update(latest draft)` (for callers that run
   * later, such as the bulk toast's Undo, and must not use a stale draft).
   * Pushes an undo entry unless nothing changed.
   */
  update: (update: (current: SubmissionHumanReview) => SubmissionHumanReview) => void;
  /** Saves the draft. Resolves with the outcome, or rejects with the server error. */
  save: () => Promise<SaveOutcome | null>;
  /** The latest saved submission (initial props, then each save response). */
  saved: SubmissionDetail;
  setReviewerNotes: (value: string) => void;
  /** ⌘Z. Returns false when there is nothing to undo. */
  undo: () => boolean;
};

function normalize(submission: Pick<SubmissionDetail, "extraction" | "review">) {
  return normalizeSubmissionReview(submission.extraction, submission.review);
}

/**
 * The review draft (§5.4): initialised once from the saved review, an undo
 * stack, dirty tracking (addendum I), explicit save, the navigation guard
 * while dirty and the localStorage mirror with its restore offer (addendum S).
 * The workspace is keyed by submission id, so later props never reseed it.
 */
export function useReviewDraft({
  initialSubmission,
  services,
}: {
  initialSubmission: SubmissionDetail;
  services: Pick<ReviewWorkspaceServices, "saveReview">;
}): ReviewDraftApi {
  const submissionId = initialSubmission.submissionId;
  const partNumber = initialSubmission.intake.partNumber;
  const [saved, setSaved] = useState<SubmissionDetail>(() => ({
    ...initialSubmission,
    review: normalize(initialSubmission),
  }));
  const [state, setState] = useState<DraftState>(() => ({
    draft: normalize(initialSubmission),
    past: [],
    version: 0,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [mirrorHandled, setMirrorHandled] = useState(false);
  const { draft, past, version } = state;

  const changedDecisions = countChangedDecisions(saved.review, draft);
  const notesChanged = hasReviewerNotesChanged(saved.review, draft);
  const changedCount = changedDecisions + (notesChanged ? 1 : 0);
  const isDirty = changedCount > 0;

  /* ------------------------------ Mirror --------------------------------- */

  const storedMirror = useMountValue<DraftMirror | null>(
    () => takeDraftMirror(submissionId, initialSubmission.updatedAt),
    null,
  );
  const mirrorReview = storedMirror
    ? normalizeSubmissionReview(initialSubmission.extraction, storedMirror.review)
    : null;
  const pendingMirror =
    storedMirror &&
    mirrorReview &&
    !mirrorHandled &&
    version === 0 &&
    isReviewDraftDirty(saved.review, mirrorReview)
      ? { review: mirrorReview, savedAt: storedMirror.savedAt }
      : null;

  const savedUpdatedAt = saved.updatedAt;
  /** Runs when the workspace unmounts (in-app navigation); null while untouched. */
  const unmountFlushRef = useRef<(() => void) | null>(null);
  /**
   * The draft version the reviewer chose "Discard changes" on in the leave
   * guard. Until the draft changes again, the mirror must not be written back:
   * a Back to another document still fires pagehide with the draft dirty.
   */
  const discardedVersionRef = useRef<number | null>(null);

  useEffect(() => {
    // Untouched since mount: leave any mirror alone until the reviewer decides.
    if (version === 0) {
      unmountFlushRef.current = null;
      return;
    }

    function syncMirror() {
      if (discardedVersionRef.current === version) {
        return;
      }

      if (isDirty) {
        writeDraftMirror(submissionId, savedUpdatedAt, draft);
      } else {
        clearDraftMirrors(submissionId);
      }
    }

    const timer = window.setTimeout(syncMirror, MIRROR_DEBOUNCE_MS);

    // Leaving the page (reload, tab close) inside the debounce window: write
    // the latest draft, or drop a mirror left from when the draft was dirty.
    // Skipped after the leave guard's "Discard changes" for this version.
    function flush() {
      window.clearTimeout(timer);
      syncMirror();
    }

    // In-app navigation away while dirty always goes through the leave guard,
    // whose "Discard changes" clears the mirror, so unmounting never writes;
    // it only drops a stale mirror when the draft was made clean again.
    unmountFlushRef.current = isDirty ? null : () => clearDraftMirrors(submissionId);

    window.addEventListener("pagehide", flush);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, [draft, isDirty, savedUpdatedAt, submissionId, version]);

  useEffect(() => {
    const flushes = unmountFlushRef;

    return () => {
      flushes.current?.();
    };
  }, []);

  /* ------------------------------- Guard ---------------------------------- */

  useNavigationGuard(
    isDirty
      ? {
          description: `You have ${changedCount} unsaved ${changedCount === 1 ? "change" : "changes"} on ${partNumber}.`,
          leaveLabel: "Discard changes",
          level: "navigation",
          onLeave: () => {
            discardedVersionRef.current = version;
            clearDraftMirrors(submissionId);
          },
          stayLabel: "Keep reviewing",
          title: "Discard unsaved review changes?",
        }
      : null,
  );

  /* ------------------------------ Actions --------------------------------- */

  function commitWith(
    getNext: (current: SubmissionHumanReview) => SubmissionHumanReview,
    options: CommitOptions = {},
  ) {
    const restoresNotes = options.kind === "discard" || options.kind === "restore";

    setState((current) => {
      const next = getNext(current.draft);

      // A no-op (confirming a confirmed row, U on a pending row) adds no undo entry.
      if (
        next === current.draft ||
        (countChangedDecisions(current.draft, next) === 0 &&
          next.reviewerNotes === current.draft.reviewerNotes)
      ) {
        return current;
      }

      return {
        draft: next,
        past: [...current.past, { restoresNotes, review: current.draft }].slice(-MAX_UNDO),
        version: current.version + 1,
      };
    });
  }

  function commit(next: SubmissionHumanReview, options: CommitOptions = {}) {
    commitWith(() => next, options);
  }

  function update(getNext: (current: SubmissionHumanReview) => SubmissionHumanReview) {
    commitWith(getNext);
  }

  function setReviewerNotes(value: string) {
    setState((current) => ({
      ...current,
      draft: { ...current.draft, reviewerNotes: value },
      version: current.version + 1,
    }));
  }

  function undo() {
    if (past.length === 0) {
      return false;
    }

    setState((current) => {
      const entry = current.past[current.past.length - 1];

      if (!entry) {
        return current;
      }

      return {
        draft: entry.restoresNotes
          ? entry.review
          : { ...entry.review, reviewerNotes: current.draft.reviewerNotes },
        past: current.past.slice(0, -1),
        version: current.version + 1,
      };
    });

    return true;
  }

  function clearHistory() {
    setState((current) => (current.past.length === 0 ? current : { ...current, past: [] }));
  }

  function discard() {
    // saved.review is about to be replaced by the save response; discarding to
    // it now would leave a draft that undoes the save once it resolves.
    if (isSaving) {
      return;
    }

    commit(saved.review, { kind: "discard" });
    clearDraftMirrors(submissionId);
  }

  // A promise chain, not try/finally: the React Compiler bails out on
  // try statements without a catch, which would leave this hook unmemoised.
  function save(): Promise<SaveOutcome | null> {
    if (isSaving || !isDirty) {
      return Promise.resolve(null);
    }

    const payload = draft;
    const wasPending = countReviewDecisions(saved.review).pending > 0;

    setIsSaving(true);

    return services
      .saveReview(submissionId, payload)
      .then((response) => {
        const savedReview = normalize({
          extraction: response.extraction ?? initialSubmission.extraction,
          review: response.review,
        });
        const next: SubmissionDetail = { ...response, review: savedReview };

        setSaved(next);
        // Keep edits made while the request was in flight; otherwise adopt the
        // saved review and clear the undo stack (§5.4).
        setState((current) =>
          current.draft === payload
            ? { draft: savedReview, past: [], version: current.version + 1 }
            : current,
        );
        clearDraftMirrors(submissionId);

        return {
          justCompleted: wasPending && countReviewDecisions(savedReview).pending === 0,
          submission: next,
        };
      })
      .finally(() => setIsSaving(false));
  }

  return {
    canUndo: past.length > 0,
    changedCount,
    clearHistory,
    commit,
    discard,
    draft,
    isDirty,
    isSaving,
    mirror: {
      dismiss: () => {
        clearDraftMirrors(submissionId);
        setMirrorHandled(true);
      },
      pending: pendingMirror,
      restore: () => {
        if (pendingMirror) {
          commit(pendingMirror.review, { kind: "restore" });
        }

        setMirrorHandled(true);
      },
    },
    save,
    saved,
    setReviewerNotes,
    undo,
    update,
  };
}
