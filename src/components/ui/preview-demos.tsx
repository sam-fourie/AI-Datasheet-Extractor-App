"use client";

/*
 * Interactive demos for the internal /preview style guide. Not exported from
 * the ui index and not used by product screens.
 */

import { useRef, useState, type ReactNode } from "react";
import {
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  LayoutList,
  Pencil,
  Play,
  RefreshCw,
  Rows3,
  Trash2,
} from "lucide-react";

import { Button } from "./button";
import { Callout } from "./callout";
import { Combobox, type ComboboxGroup } from "./combobox";
import { Dialog, type DialogSize, type DialogVariant } from "./dialog";
import { Field } from "./field";
import { IconButton } from "./icon-button";
import { Menu } from "./menu";
import { Popover } from "./popover";
import { SearchField } from "./search-field";
import { SegmentedControl } from "./segmented-control";
import { SelectField } from "./select-field";
import { TextField } from "./text-field";
import { Textarea } from "./textarea";
import { useToast } from "./toast";
import { Tooltip } from "./tooltip";

const categoryGroups: ComboboxGroup[] = [
  {
    label: "Surface mount",
    options: [
      {
        keywords: ["soic", "so-8", "sop"],
        label: "Small Outline Packages",
        meta: "SOIC",
        value: "soic",
      },
      {
        keywords: ["qfn", "dfn", "son"],
        label: "Quad Flat No-Lead",
        meta: "QFN",
        value: "qfn",
      },
      {
        keywords: ["qfp", "lqfp", "tqfp"],
        label: "Quad Flat Packages",
        meta: "QFP",
        value: "qfp",
      },
      {
        keywords: ["bga", "ball grid"],
        label: "Ball Grid Array",
        meta: "BGA",
        value: "bga",
      },
    ],
  },
  {
    label: "Through hole",
    options: [
      {
        keywords: ["dip", "pdip"],
        label: "Dual In-line Packages",
        meta: "DIP",
        value: "dip",
      },
      {
        keywords: ["to-220", "to220", "transistor outline"],
        label: "Transistor Outline",
        meta: "TO",
        value: "to",
      },
    ],
  },
];

export function PreviewDemos({
  section,
}: {
  section: "forms" | "segmented" | "overlays" | "feedback";
}) {
  return (
    <>
      {section === "forms" ? <FormDemos /> : null}
      {section === "segmented" ? <SegmentedDemos /> : null}
      {section === "overlays" ? <OverlayDemos /> : null}
      {section === "feedback" ? <FeedbackDemos /> : null}
    </>
  );
}

function DemoRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-2 border-t border-border-subtle py-4 first-of-type:border-t-0 first-of-type:pt-0 last-of-type:pb-0 md:grid-cols-[160px_minmax(0,1fr)] md:gap-6">
      <p className="text-callout text-text-muted md:pt-1.5">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function FormDemos() {
  const [category, setCategory] = useState<string | null>("soic");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  return (
    <>
      <DemoRow label="Text field">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field
            hint="As printed on the datasheet."
            htmlFor="demo-part"
            label="Part number"
          >
            <TextField id="demo-part" placeholder="NE555DR" />
          </Field>
          <Field htmlFor="demo-part-lg" label="Large (intake)">
            <TextField
              controlSize="lg"
              defaultValue="CY8C5668AXI-LP010"
              id="demo-part-lg"
            />
          </Field>
          <Field
            error="Enter a part number."
            htmlFor="demo-part-error"
            label="Invalid"
            required
          >
            <TextField id="demo-part-error" invalid />
          </Field>
          <Field htmlFor="demo-part-disabled" label="Disabled">
            <TextField
              defaultValue="Locked value"
              disabled
              id="demo-part-disabled"
            />
          </Field>
        </div>
      </DemoRow>
      <DemoRow label="Select and number">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field htmlFor="demo-effort" label="Reasoning effort">
            <SelectField defaultValue="high" id="demo-effort">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </SelectField>
          </Field>
          <Field htmlFor="demo-effort-disabled" label="Select, disabled">
            <SelectField defaultValue="high" disabled id="demo-effort-disabled">
              <option value="high">High</option>
            </SelectField>
          </Field>
        </div>
      </DemoRow>
      <DemoRow label="Textarea (auto-grow)">
        <Field
          className="w-full"
          hint="Grows as you type, up to 16 lines."
          htmlFor="demo-notes"
          label="Reviewer notes"
        >
          <Textarea
            autoGrow
            id="demo-notes"
            placeholder="Anything the next reviewer should know"
            rows={2}
          />
        </Field>
      </DemoRow>
      <DemoRow label="Combobox with groups">
        <Field
          className="w-full max-w-sm"
          hint={`Try "soic", "to220" or "ball". Selected: ${category ?? "none"}`}
          htmlFor="demo-category"
          label="Package category"
        >
          <Combobox
            groups={categoryGroups}
            id="demo-category"
            onChange={setCategory}
            placeholder="Search categories"
            value={category}
          />
        </Field>
      </DemoRow>
      <DemoRow label="Search field">
        <div className="w-full max-w-sm space-y-2">
          <SearchField
            aria-label="Search submissions"
            debounceMs={250}
            onChange={(value) => {
              setSearch(value);
              setCommittedSearch(value);
            }}
            placeholder="Search part numbers"
            shortcutKey="/"
            value={search}
          />
          <p className="text-caption text-text-muted">
            Press / to focus. Debounced value:{" "}
            {committedSearch ? `"${committedSearch}"` : "empty"}
          </p>
        </div>
      </DemoRow>
    </>
  );
}

function SegmentedDemos() {
  const [status, setStatus] = useState("needs-review");
  const [mode, setMode] = useState("list");
  const [range, setRange] = useState("30d");

  return (
    <>
      <DemoRow label="With counts">
        <SegmentedControl
          aria-label="Status"
          onChange={setStatus}
          options={[
            { count: 13, label: "All", value: "all" },
            { count: 9, label: "Needs review", value: "needs-review" },
            { count: 4, label: "Reviewed", value: "reviewed" },
          ]}
          value={status}
        />
      </DemoRow>
      <DemoRow label="Small with icons">
        <SegmentedControl
          aria-label="Layout"
          onChange={setMode}
          options={[
            { icon: <LayoutList />, label: "List", value: "list" },
            { icon: <Rows3 />, label: "Compact", value: "compact" },
            {
              disabled: true,
              icon: <FileText />,
              label: "Disabled",
              value: "pdf",
            },
          ]}
          size="sm"
          value={mode}
        />
      </DemoRow>
      <DemoRow label="Full width">
        <SegmentedControl
          aria-label="Date range"
          fullWidth
          onChange={setRange}
          options={[
            { label: "7 days", value: "7d" },
            { label: "30 days", value: "30d" },
            { label: "90 days", value: "90d" },
            { label: "All time", value: "all" },
          ]}
          value={range}
        />
      </DemoRow>
    </>
  );
}

type DialogDemo = {
  size: DialogSize;
  variant: DialogVariant;
  role?: "alertdialog";
  width?: string;
} | null;

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Part number", value: "part" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

function OverlayDemos() {
  const [dialog, setDialog] = useState<DialogDemo>(null);
  const [sort, setSort] = useState<SortValue>("newest");
  const [showBaseline, setShowBaseline] = useState(true);
  const stayRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const close = () => setDialog(null);

  return (
    <>
      <DemoRow label="Dialog">
        <Button
          onClick={() => setDialog({ size: "sm", variant: "center" })}
          variant="secondary"
        >
          Center, small
        </Button>
        <Button
          onClick={() => setDialog({ size: "md", variant: "center" })}
          variant="secondary"
        >
          Center, form
        </Button>
        <Button
          onClick={() =>
            setDialog({ role: "alertdialog", size: "sm", variant: "center" })
          }
          variant="secondary"
        >
          Alert dialog
        </Button>
        <Button
          onClick={() => setDialog({ size: "md", variant: "sheet-right" })}
          variant="secondary"
        >
          Sheet right
        </Button>
        <Button
          onClick={() => setDialog({ size: "lg", variant: "sheet-bottom" })}
          variant="secondary"
        >
          Sheet bottom
        </Button>
        <Button
          onClick={() =>
            setDialog({
              size: "lg",
              variant: "sheet-right",
              width: "min(720px, 72vw)",
            })
          }
          variant="secondary"
        >
          Sheet, custom width
        </Button>
      </DemoRow>
      <DemoRow label="Menu">
        <Menu
          items={[
            {
              icon: <Pencil />,
              label: "Edit review",
              onSelect: () => toast.show({ title: "Edit review" }),
              shortcut: "E",
            },
            {
              icon: <RefreshCw />,
              label: "Run another model…",
              onSelect: () => toast.show({ title: "Run another model" }),
            },
            {
              disabled: true,
              disabledReason: "Save or discard your changes first",
              icon: <Play />,
              label: "Re-run with same model",
            },
            "separator",
            { href: "/submissions", icon: <Rows3 />, label: "All submissions" },
            {
              external: true,
              href: "https://www.ti.com/lit/ds/symlink/ne555.pdf",
              icon: <ExternalLink />,
              label: "Open vendor PDF",
            },
            {
              icon: <Download />,
              label: "Download JSON",
              onSelect: () => toast.show({ title: "Downloaded" }),
            },
            "separator",
            {
              icon: <Trash2 />,
              label: "Delete submission…",
              onSelect: () =>
                setDialog({
                  role: "alertdialog",
                  size: "sm",
                  variant: "center",
                }),
              tone: "danger",
            },
          ]}
          trigger={<Button variant="secondary">Actions</Button>}
        />
        <Menu
          align="end"
          items={[
            {
              icon: <Copy />,
              label: "Copy link",
              onSelect: () =>
                toast.show({ title: "Link copied", tone: "success" }),
            },
            {
              icon: <Trash2 />,
              label: "Delete",
              onSelect: () => undefined,
              tone: "danger",
            },
          ]}
          label="More actions"
          trigger={
            <IconButton
              icon={<Ellipsis />}
              label="More actions"
              tooltip={false}
              variant="secondary"
            />
          }
        />
        <Menu
          items={[
            ...sortOptions.map((option) => ({
              checked: option.value === sort,
              label: option.label,
              onSelect: () => setSort(option.value),
            })),
            "separator",
            {
              checked: showBaseline,
              itemRole: "menuitemcheckbox",
              label: "Show baseline values",
              onSelect: () => setShowBaseline((current) => !current),
            },
          ]}
          label="Sort and view"
          trigger={
            <Button variant="secondary">
              Sort: {sortOptions.find((option) => option.value === sort)?.label}
            </Button>
          }
        />
        <span className="text-caption text-text-muted">
          Arrow keys, Home, End, type-ahead and Escape. Checkable items use
          menuitemradio or menuitemcheckbox with aria-checked.
        </span>
      </DemoRow>
      <DemoRow label="Popover">
        <Popover
          label="Run details"
          trigger={<Button variant="secondary">Run details</Button>}
        >
          {({ close: closePopover }) => (
            <div className="space-y-3">
              <p className="text-title-3">GPT-5.6 Terra · High</p>
              <p className="text-callout text-text-muted">
                23.4 s · 18,204 tokens · $0.22 est. Extracted Sep 21, 2026.
              </p>
              <Button onClick={closePopover} size="sm" variant="secondary">
                Close
              </Button>
            </div>
          )}
        </Popover>
      </DemoRow>
      <DemoRow label="Tooltip">
        <Tooltip content="Confirm (C)">
          <Button variant="secondary">Hover or focus me</Button>
        </Tooltip>
        <Tooltip content="Shown below" side="bottom">
          <Button variant="ghost">Bottom</Button>
        </Tooltip>
        <IconButton icon={<Copy />} label="Copy part number" />
        <IconButton
          icon={<Download />}
          label="Save review"
          shortcut="⌘S"
          variant="secondary"
        />
      </DemoRow>
      <DemoRow label="Tooltip on aria-disabled">
        <Tooltip content="Save or discard your changes first">
          <Button
            aria-disabled="true"
            onClick={() => toast.show({ title: "This should never show" })}
          >
            Re-run
          </Button>
        </Tooltip>
        <IconButton
          aria-disabled="true"
          icon={<Trash2 />}
          label="Delete (finish the run first)"
          onClick={() => toast.show({ title: "This should never show" })}
          variant="secondary"
        />
        <span className="text-caption text-text-muted">
          Focusable and described by the tooltip; clicks do nothing.
        </span>
      </DemoRow>

      <Dialog
        description="This removes the baseline and its 3 model runs. It can't be undone."
        footer={
          <>
            <Button onClick={close} ref={stayRef} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                close();
                toast.show({ title: "Submission deleted", tone: "neutral" });
              }}
              variant="danger"
            >
              Delete
            </Button>
          </>
        }
        initialFocusRef={stayRef}
        onClose={close}
        open={dialog?.role === "alertdialog"}
        role="alertdialog"
        size="sm"
        title="Delete NE555DR?"
      />
      <Dialog
        description="Share what the AI got wrong."
        footer={
          <>
            <Button onClick={close} variant="secondary">
              Cancel
            </Button>
            <Button onClick={close}>Save</Button>
          </>
        }
        onClose={close}
        open={dialog !== null && dialog.role !== "alertdialog"}
        size={dialog?.size ?? "md"}
        title={
          dialog?.variant === "sheet-right"
            ? "Datasheet details"
            : dialog?.variant === "sheet-bottom"
              ? "Filters"
              : dialog?.size === "sm"
                ? "Discard changes?"
                : "Correct measurement"
        }
        variant={dialog?.variant ?? "center"}
        width={dialog?.width}
      >
        {dialog?.size === "sm" ? (
          <p className="text-text-muted">
            You have 4 unsaved decisions. They will be lost.
          </p>
        ) : (
          <div className="space-y-4">
            <Field htmlFor="demo-dialog-value" label="Corrected value">
              <TextField defaultValue="4.90 mm" id="demo-dialog-value" />
            </Field>
            <Field htmlFor="demo-dialog-note" label="Note">
              <Textarea autoGrow id="demo-dialog-note" rows={3} />
            </Field>
            {dialog?.variant !== "center" ? (
              <p className="text-callout text-text-muted">
                Sheets scroll their body and keep the footer pinned.
                {dialog?.width ? ` This one is ${dialog.width} wide.` : null}
              </p>
            ) : null}
            <Button
              onClick={() =>
                toast.show({
                  description: "Toasts sit in the top layer above dialogs.",
                  title: "Shown above the dialog",
                  tone: "accent",
                })
              }
              size="sm"
              variant="secondary"
            >
              Show a toast
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

function FeedbackDemos() {
  const toast = useToast();

  return (
    <>
      <DemoRow label="Toast">
        <Button
          onClick={() =>
            toast.show({
              action: { href: "/submissions", label: "Open run" },
              description: "91% agreement with the reviewed baseline.",
              title: "GPT-5.6 Sol finished",
              tone: "success",
            })
          }
          variant="secondary"
        >
          Success with link action
        </Button>
        <Button
          onClick={() =>
            toast.show({
              action: {
                label: "Undo",
                onClick: () => toast.show({ title: "Restored 38 pins" }),
              },
              title: "Confirmed 38 pins",
            })
          }
          variant="secondary"
        >
          Neutral with undo
        </Button>
        <Button
          onClick={() =>
            toast.show({
              description: "Check your connection and try again.",
              durationMs: 0,
              title: "Couldn't save the review",
              tone: "danger",
            })
          }
          variant="secondary"
        >
          Danger, sticky
        </Button>
      </DemoRow>
      <DemoRow label="Callout, dismissible">
        <Callout
          actions={
            <>
              <Button size="sm" variant="secondary">
                Restore
              </Button>
              <Button size="sm" variant="ghost">
                Discard
              </Button>
            </>
          }
          className="w-full"
          dismissible
          tone="accent"
        >
          You have unsaved review changes from 5 min ago.
        </Callout>
      </DemoRow>
    </>
  );
}
