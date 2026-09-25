"use client";

import { Fragment } from "react";

import { Dialog, Kbd, Switch } from "@/components/ui";

import { useMountValue } from "./review-storage";

export type ShortcutsDialogProps = {
  autoAdvance: boolean;
  onAutoAdvanceChange: (value: boolean) => void;
  onClose: () => void;
  onSingleKeyShortcutsChange: (value: boolean) => void;
  open: boolean;
  /** Off: only ⌘/Ctrl shortcuts and Esc work (WCAG 2.1.4). */
  singleKeyShortcuts: boolean;
};

type ShortcutRow = { keys: string[][]; label: string };

function buildRows(mod: string): ShortcutRow[] {
  return [
    { keys: [["J"], ["↓"]], label: "Next row" },
    { keys: [["K"], ["↑"]], label: "Previous row" },
    { keys: [["C"], ["Enter"]], label: "Confirm" },
    { keys: [["X"]], label: "Incorrect: open the correction" },
    { keys: [["U"], ["⌫"]], label: "Back to pending" },
    { keys: [["N"], ["⇧", "N"]], label: "Next / previous pending row" },
    { keys: [["["], ["]"]], label: "Previous / next evidence page" },
    { keys: [["P"]], label: "Show the datasheet at this row" },
    { keys: [["/"]], label: "Find pin" },
    { keys: [["E"]], label: "Edit review" },
    { keys: [[mod, "S"]], label: "Save" },
    { keys: [[mod, "Z"]], label: "Undo" },
    { keys: [["Esc"]], label: "Close the correction or search" },
    { keys: [["?"]], label: "Show these shortcuts" },
  ];
}

function detectMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/**
 * "?" dialog: every shortcut with its key, the auto-advance switch (§5.3,
 * §5.7) and a switch that turns the single-key shortcuts off (WCAG 2.1.4).
 */
export function ShortcutsDialog({
  autoAdvance,
  onAutoAdvanceChange,
  onClose,
  onSingleKeyShortcutsChange,
  open,
  singleKeyShortcuts,
}: ShortcutsDialogProps) {
  const isMac = useMountValue(detectMac, true);
  const rows = buildRows(isMac ? "⌘" : "Ctrl");

  return (
    <Dialog onClose={onClose} open={open} size="sm" title="Keyboard shortcuts">
      <div className="space-y-5 pb-1">
        <dl className="grid grid-cols-[minmax(88px,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5">
          {rows.map((row) => (
            <Fragment key={row.label}>
              <dt className="flex flex-wrap items-center gap-1">
                {row.keys.map((combo, comboIndex) => (
                  <Fragment key={combo.join("+")}>
                    {comboIndex > 0 ? (
                      <span aria-hidden="true" className="text-caption text-text-tertiary">
                        /
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-0.5">
                      {combo.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </Fragment>
                ))}
              </dt>
              <dd className="text-callout text-text">{row.label}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="text-caption text-text-muted">
          Letter keys work while a row or the page has focus; C, X, U, Enter and ⌫ only on a row.
        </p>
        <div className="space-y-4 border-t border-border-subtle pt-4">
          <Switch
            checked={singleKeyShortcuts}
            hint={`Off: only ${isMac ? "⌘" : "Ctrl+"}S, ${isMac ? "⌘" : "Ctrl+"}Z and Esc work, so stray keys (or speech input) never change a decision.`}
            label="Single-key shortcuts"
            onChange={(event) => onSingleKeyShortcutsChange(event.target.checked)}
          />
          <Switch
            checked={autoAdvance}
            hint={`After C, Enter or ${isMac ? "⌘" : "Ctrl+"}Enter. Clicking never moves the list.`}
            label="Move to the next pending row"
            onChange={(event) => onAutoAdvanceChange(event.target.checked)}
          />
        </div>
      </div>
    </Dialog>
  );
}
