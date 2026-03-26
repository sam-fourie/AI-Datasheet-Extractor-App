import Link from "next/link";

import {
  Button,
  Card,
  Checkbox,
  Field,
  Label,
  NumberField,
  SelectField,
  Switch,
  TextField,
  Textarea,
} from "@/components/ui";

const foundationHighlights = [
  {
    eyebrow: "Light-first",
    title: "Token-driven theme",
    body: "Neutral surfaces, restrained blue accents, and future-ready variable names live in the global stylesheet.",
  },
  {
    eyebrow: "Shared UI",
    title: "Reusable primitives",
    body: "Buttons, fields, cards, and controls now define the standard look for the rest of the product.",
  },
  {
    eyebrow: "Low JS",
    title: "Native controls first",
    body: "Inputs stay server-safe and accessible by leaning on the platform before adding client-only abstractions.",
  },
];

const designRules = [
  "Prefer the shared primitives in src/components/ui before creating one-off form controls.",
  "Keep the visual system restrained: neutral palette, soft depth, and a single clear accent.",
  "Use the global theme tokens in src/app/globals.css instead of hard-coding component colors.",
];

export default function PreviewPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8 md:gap-8 md:py-12">
        <Card className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
              Internal Route
            </p>
            <h1 className="text-3xl">UI foundation preview</h1>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              The original component and styling showcase now lives here so the
              home page can stay focused on datasheet intake.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border bg-surface px-5 text-[15px] font-medium tracking-[-0.01em] text-text shadow-soft transition duration-150 ease-out hover:border-border-strong hover:bg-surface-muted"
            href="/"
          >
            Back to extractor
          </Link>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="grid gap-8 p-8 md:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] md:p-10">
            <div className="space-y-6">
              <div className="inline-flex w-fit rounded-pill border border-border-strong bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                AI Datasheet Extractor
              </div>
              <div className="space-y-4">
                <h2 className="max-w-4xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                  Shared UI foundation for a clean, Apple-style workflow.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
                  Tailwind v4 tokens now define the theme, and the shared
                  primitives in <code>src/components/ui</code> provide the
                  reusable baseline for buttons, fields, cards, and native form
                  controls across the app.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg">Primary Action</Button>
                <Button size="lg" variant="secondary">
                  Secondary Action
                </Button>
                <Button size="lg" variant="ghost">
                  Quiet Action
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
              {foundationHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="rounded-control border border-border bg-surface-muted p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {highlight.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl">{highlight.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {highlight.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="grid gap-6">
            <Card className="space-y-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Buttons
                </p>
                <h2 className="text-3xl">Action styles and sizing</h2>
                <p className="max-w-2xl text-sm leading-6 text-text-muted">
                  Rounded pill buttons keep the visual language calm and
                  consistent while preserving clear emphasis for primary and
                  destructive actions.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="mb-4 text-sm font-medium text-text">
                    Variants
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Delete</Button>
                  </div>
                </div>
                <div className="rounded-control border border-border bg-surface-muted p-4">
                  <p className="mb-4 text-sm font-medium text-text">Sizes</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="secondary">
                      Small
                    </Button>
                    <Button size="md" variant="secondary">
                      Medium
                    </Button>
                    <Button size="lg" variant="secondary">
                      Large
                    </Button>
                    <Button disabled variant="secondary">
                      Disabled
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="space-y-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Form Fields
                </p>
                <h2 className="text-3xl">Native inputs with shared wrapping</h2>
                <p className="max-w-2xl text-sm leading-6 text-text-muted">
                  Use the field wrapper to keep labels, hints, and validation
                  aligned while the controls stay thin wrappers around native
                  elements.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  hint="Use the dataset name that appears in the uploaded source bundle."
                  htmlFor="dataset-name"
                  label="Dataset name"
                  required
                >
                  <TextField
                    id="dataset-name"
                    placeholder="ACME power regulators"
                  />
                </Field>
                <Field
                  hint="Numeric values keep the same control styling as text inputs."
                  htmlFor="revision"
                  label="Revision"
                >
                  <NumberField id="revision" min={1} step={1} defaultValue={2} />
                </Field>
                <Field
                  hint="Select fields stay native and server-safe."
                  htmlFor="package-family"
                  label="Package family"
                >
                  <SelectField defaultValue="soic" id="package-family">
                    <option value="qfn">QFN</option>
                    <option value="soic">SOIC</option>
                    <option value="tssop">TSSOP</option>
                    <option value="bga">BGA</option>
                  </SelectField>
                </Field>
                <Field
                  error="Use a valid HTTPS datasheet URL."
                  htmlFor="datasheet-url"
                  label="Datasheet URL"
                >
                  <TextField
                    id="datasheet-url"
                    placeholder="https://vendor.example.com/datasheet.pdf"
                  />
                </Field>
                <Field
                  className="md:col-span-2"
                  hint="Textareas keep the same focus, border, and invalid rules as the other fields."
                  htmlFor="notes"
                  label="Extraction notes"
                >
                  <Textarea
                    id="notes"
                    defaultValue="Normalize unit abbreviations, keep package dimensions in metric, and preserve the original tolerance wording."
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Typography
                </p>
                <h2 className="text-3xl">Quiet hierarchy, tight spacing</h2>
              </div>
              <div className="space-y-4 rounded-control border border-border bg-surface-muted p-5">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                    Headline
                  </p>
                  <h3 className="mt-2 text-2xl">
                    Datasheet parsing should feel precise and calm.
                  </h3>
                </div>
                <p className="text-base leading-7 text-text-muted">
                  Body copy uses a restrained system stack, softened contrast,
                  and consistent line height to keep dense extraction workflows
                  readable.
                </p>
                <div className="rounded-control border border-border bg-surface px-4 py-3">
                  <Label>Label primitive</Label>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Compact form labels maintain the same rhythm across every
                    field wrapper.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Controls
                </p>
                <h2 className="text-3xl">Checkbox and switch</h2>
              </div>
              <div className="space-y-5 rounded-control border border-border bg-surface-muted p-5">
                <Checkbox
                  defaultChecked
                  hint="Stores the raw OCR text alongside normalized values for debugging."
                  label="Attach OCR output to each extraction"
                />
                <Switch
                  defaultChecked
                  hint="Highlights low-confidence values after the extraction pass finishes."
                  label="Enable automatic confidence scoring"
                />
                <Switch
                  disabled
                  hint="Future client-only behaviors can layer on top without changing the shared visual standard."
                  label="Client-enhanced review panel"
                />
              </div>
            </Card>

            <Card className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-muted">
                  Standards
                </p>
                <h2 className="text-3xl">Shared implementation rules</h2>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-text-muted">
                  <code className="rounded-pill border border-border bg-surface-muted px-3 py-1.5">
                    src/app/globals.css
                  </code>
                  <code className="rounded-pill border border-border bg-surface-muted px-3 py-1.5">
                    src/components/ui
                  </code>
                  <code className="rounded-pill border border-border bg-surface-muted px-3 py-1.5">
                    AGENTS.md
                  </code>
                </div>
                <ul className="space-y-3">
                  {designRules.map((rule) => (
                    <li
                      key={rule}
                      className="rounded-control border border-border bg-surface-muted px-4 py-3 text-sm leading-6 text-text-muted"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
