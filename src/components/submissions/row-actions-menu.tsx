"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Ellipsis, FileText, Link2, Trash2 } from "lucide-react";

import { useBackgroundTasks } from "@/components/background-tasks-provider";
import {
  DeleteSubmissionDialog,
  RUN_IN_PROGRESS_REASON,
  type DeleteSubmissionTarget,
} from "@/components/delete-submission-dialog";
import { IconButton, Menu, useToast, type MenuEntry } from "@/components/ui";

import { buildReviewHref } from "./datasheet-list-format";

type RowActionsContextValue = {
  requestDelete: (target: DeleteSubmissionTarget, origin: HTMLElement | null) => void;
};

const RowActionsContext = createContext<RowActionsContextValue | null>(null);

function findRowLink(groupElement: Element | null) {
  return groupElement?.querySelector<HTMLElement>("[data-row-link]") ?? null;
}

function focusAfterDelete(nextRowId: string | null) {
  const nextLink = nextRowId
    ? document.querySelector<HTMLElement>(
        `[data-row-link="${CSS.escape(nextRowId)}"]`,
      )
    : null;

  if (nextLink) {
    nextLink.focus();
    return;
  }

  const heading = document.querySelector<HTMLElement>("main h1");

  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
}

/**
 * Holds the one delete dialog for the list. After a delete the list refreshes
 * in place and focus moves to the next row's link (or the previous one, or
 * the page heading when the list is now empty).
 */
export function RowActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DeleteSubmissionTarget | null>(null);
  const [open, setOpen] = useState(false);
  const nextRowIdRef = useRef<string | null>(null);

  function requestDelete(nextTarget: DeleteSubmissionTarget, origin: HTMLElement | null) {
    const group = origin?.closest("tbody") ?? null;
    const nextLink =
      findRowLink(group?.nextElementSibling ?? null) ??
      findRowLink(group?.previousElementSibling ?? null);

    nextRowIdRef.current = nextLink?.dataset.rowLink ?? null;
    setTarget(nextTarget);
    setOpen(true);
  }

  function handleDeleted() {
    const nextRowId = nextRowIdRef.current;

    // Wait for the dialog to close and restore focus to its opener first.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusAfterDelete(nextRowId));
    });
  }

  return (
    <RowActionsContext.Provider value={{ requestDelete }}>
      {children}
      <DeleteSubmissionDialog
        onClose={() => setOpen(false)}
        onDeleted={handleDeleted}
        open={open}
        redirectHref={null}
        target={target}
      />
    </RowActionsContext.Provider>
  );
}

export type RowActionsMenuProps = {
  /** Baseline id (or the orphan run's own id); background tasks key on it. */
  groupId: string;
  partNumber: string;
  pdfHref: string | null;
  submissionId: string;
  target: DeleteSubmissionTarget;
};

/** Row ⋯ menu: Open review · View PDF · Copy link · Delete… */
export function RowActionsMenu({
  groupId,
  partNumber,
  pdfHref,
  submissionId,
  target,
}: RowActionsMenuProps) {
  const context = useContext(RowActionsContext);
  const toast = useToast();
  const { isGroupBusy } = useBackgroundTasks();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reviewHref = buildReviewHref(submissionId);
  const isBusy = isGroupBusy(groupId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(reviewHref, window.location.origin).toString(),
      );
      toast.show({ title: "Link copied", tone: "success" });
    } catch {
      toast.show({ title: "Couldn't copy the link", tone: "danger" });
    }
  }

  const items: MenuEntry[] = [
    { href: reviewHref, icon: <ArrowRight />, label: "Open review" },
    pdfHref
      ? { external: true, href: pdfHref, icon: <FileText />, label: "View PDF" }
      : {
          disabled: true,
          disabledReason: "The uploaded PDF wasn't kept",
          icon: <FileText />,
          label: "View PDF",
        },
    { icon: <Link2 />, label: "Copy link", onSelect: () => void copyLink() },
    "separator",
    {
      disabled: isBusy || !context,
      disabledReason: isBusy ? RUN_IN_PROGRESS_REASON : undefined,
      icon: <Trash2 />,
      label: "Delete…",
      onSelect: () => context?.requestDelete(target, triggerRef.current),
      tone: "danger",
    },
  ];

  return (
    <Menu
      align="end"
      items={items}
      label={`Actions for ${partNumber}`}
      trigger={
        <IconButton
          className="relative z-10"
          icon={<Ellipsis />}
          label={`More actions for ${partNumber}`}
          ref={triggerRef}
          size="sm"
          tooltip={false}
        />
      }
    />
  );
}
