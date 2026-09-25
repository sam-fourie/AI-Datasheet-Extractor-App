import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  FileSearch,
  FilePlus2,
  Inbox,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  DescriptionList,
  Disclosure,
  EmptyState,
  Field,
  FileField,
  Kbd,
  LinkButton,
  NumberField,
  PageHeader,
  ProgressBar,
  Skeleton,
  SkeletonText,
  Spinner,
  Stat,
  StatGroup,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  ToastProvider,
  Tooltip,
  Tr,
  type BadgeTone,
  type ButtonVariant,
  type CalloutTone,
} from "@/components/ui";
import { PreviewDemos } from "@/components/ui/preview-demos";

export const metadata: Metadata = {
  title: "UI preview",
  robots: { index: false },
};

const sections = [
  { id: "foundations", label: "Foundations" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "forms", label: "Forms" },
  { id: "segmented", label: "Segmented control" },
  { id: "overlays", label: "Overlays" },
  { id: "feedback", label: "Feedback" },
  { id: "data", label: "Data display" },
  { id: "states", label: "Empty and loading" },
];

const colorTokens: Array<{ name: string; className: string; note?: string }> = [
  { className: "bg-page", name: "page" },
  { className: "bg-surface", name: "surface" },
  { className: "bg-surface-subtle", name: "surface-subtle" },
  { className: "bg-surface-muted", name: "surface-muted" },
  { className: "bg-surface-sunken", name: "surface-sunken" },
  { className: "bg-surface-selected", name: "surface-selected" },
  { className: "bg-text", name: "text" },
  { className: "bg-text-muted", name: "text-muted" },
  { className: "bg-text-tertiary", name: "text-tertiary" },
  { className: "bg-accent", name: "accent" },
  { className: "bg-accent-soft", name: "accent-soft" },
  { className: "bg-success", name: "success" },
  { className: "bg-success-soft", name: "success-soft" },
  { className: "bg-warning", name: "warning" },
  { className: "bg-warning-soft", name: "warning-soft" },
  { className: "bg-danger", name: "danger" },
  { className: "bg-danger-soft", name: "danger-soft" },
  { className: "bg-pending", name: "pending" },
  { className: "bg-chart-neutral", name: "chart-neutral" },
  { className: "bg-chart-neutral-strong", name: "chart-neutral-strong" },
];

const typeScale = [
  { className: "text-title-1", name: "title-1", note: "28/34 · 600 · page H1" },
  {
    className: "text-title-2",
    name: "title-2",
    note: "20/26 · 600 · report sections",
  },
  {
    className: "text-title-3",
    name: "title-3",
    note: "17/22 · 600 · section titles",
  },
  { className: "text-body", name: "body", note: "14/20 · default" },
  {
    className: "text-callout text-text-muted",
    name: "callout",
    note: "13/18 · meta and hints",
  },
  {
    className: "text-caption text-text-muted",
    name: "caption",
    note: "12/16 · table headers, badges",
  },
  {
    className: "text-stat tabular-nums",
    name: "stat",
    note: "28/32 · 600 · KPI values",
  },
  {
    className: "font-mono text-callout",
    name: "data",
    note: "13/18 mono · part and pin numbers",
  },
];

const buttonVariants: ButtonVariant[] = [
  "primary",
  "secondary",
  "ghost",
  "danger",
  "plain",
];
const badgeTones: BadgeTone[] = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
];
const calloutTones: Array<{ tone: CalloutTone; title: string; body: string }> =
  [
    {
      body: "Measurements are compared against the reviewed baseline.",
      title: "How agreement works",
      tone: "neutral",
    },
    {
      body: "Extraction saved · 23.4 s · 10 measurements · 8 pins · 3 flagged by the AI.",
      title: "Ready to review",
      tone: "accent",
    },
    {
      body: "The model marked 3 values as low confidence.",
      title: "Check flagged values",
      tone: "warning",
    },
    {
      body: "The site blocked the download or the link has moved.",
      title: "We couldn't download that PDF",
      tone: "danger",
    },
    {
      body: "84% accurate. 16 confirmed, 3 corrected.",
      title: "NE555DR reviewed",
      tone: "success",
    },
  ];

function Section({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description?: string;
  id: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 space-y-3"
      id={id}
    >
      <div className="space-y-1">
        <h2 className="text-title-2" id={`${id}-title`}>
          {title}
        </h2>
        {description ? (
          <p className="text-callout text-text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-2 border-t border-border-subtle py-4 first-of-type:border-t-0 first-of-type:pt-0 last-of-type:pb-0 md:grid-cols-[160px_minmax(0,1fr)] md:gap-6">
      <p className="text-callout text-text-muted md:pt-1.5">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <ToastProvider>
      <div className="mx-auto w-full max-w-(--ui-content-default) px-4 pb-24 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <>
              <LinkButton href="/submissions" variant="secondary">
                Submissions
              </LinkButton>
              <LinkButton href="/" variant="primary">
                <FilePlus2 aria-hidden="true" />
                New extraction
              </LinkButton>
            </>
          }
          breadcrumb={[{ href: "/", label: "Home" }]}
          meta="Internal living style guide. Every primitive in src/components/ui, in every variant and state."
          title="UI preview"
        />

        <nav aria-label="Sections" className="mb-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-callout">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  className="rounded-xs text-accent-text hover:underline"
                  href={`#${section.id}`}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          <Section
            description="Tokens live in src/app/globals.css. Use the Tailwind names, never raw colours."
            id="foundations"
            title="Foundations"
          >
            <Card className="space-y-8">
              <div className="space-y-3">
                <h3 className="text-title-3">Colour</h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {colorTokens.map((token) => (
                    <li className="min-w-0 space-y-1.5" key={token.name}>
                      <div
                        className={`h-10 rounded-sm border border-border ${token.className}`}
                      />
                      <p className="truncate font-mono text-caption text-text-muted">
                        {token.name}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-title-3">Type scale</h3>
                <ul className="divide-y divide-border-subtle">
                  {typeScale.map((entry) => (
                    <li
                      className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                      key={entry.name}
                    >
                      <span className={`min-w-0 truncate ${entry.className}`}>
                        {entry.name === "stat"
                          ? "84%"
                          : entry.name === "data"
                            ? "NE555DR · pin 8"
                            : "Review workspace"}
                      </span>
                      <span className="shrink-0 font-mono text-caption text-text-muted">
                        text-{entry.name} · {entry.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-title-3">Radius</h3>
                  <div className="flex flex-wrap items-end gap-4">
                    {[
                      ["rounded-xs", "xs 6"],
                      ["rounded-sm", "sm 8"],
                      ["rounded-md", "md 12"],
                      ["rounded-lg", "lg 16"],
                      ["rounded-pill", "pill"],
                    ].map(([className, label]) => (
                      <div className="space-y-1.5 text-center" key={label}>
                        <div
                          className={`size-12 border border-border-strong bg-surface-muted ${className}`}
                        />
                        <p className="text-caption text-text-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-title-3">Elevation</h3>
                  <div className="flex flex-wrap gap-4 bg-page p-4 rounded-sm">
                    {[
                      ["shadow-xs", "xs · thumbs"],
                      ["shadow-card", "card · surfaces"],
                      ["shadow-overlay", "overlay · floating"],
                    ].map(([className, label]) => (
                      <div
                        className={`flex h-16 w-28 items-end rounded-md bg-surface p-2 text-caption text-text-muted ${className}`}
                        key={label}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </Section>

          <Section
            description="At most one primary button per view. Destructive actions turn solid red only inside a confirm dialog. Use aria-disabled with a tooltip when the reason matters: it looks disabled and ignores clicks but stays focusable."
            id="buttons"
            title="Buttons"
          >
            <Card>
              {buttonVariants.map((variant) => (
                <Row
                  key={variant}
                  label={variant[0].toUpperCase() + variant.slice(1)}
                >
                  <Button size="sm" variant={variant}>
                    Small
                  </Button>
                  <Button variant={variant}>Medium</Button>
                  <Button size="lg" variant={variant}>
                    Large
                  </Button>
                  <Button variant={variant}>
                    <Plus aria-hidden="true" />
                    With icon
                  </Button>
                  <Button disabled variant={variant}>
                    Disabled
                  </Button>
                  <Tooltip content="Save or discard your changes first">
                    <Button aria-disabled="true" variant={variant}>
                      Aria-disabled
                    </Button>
                  </Tooltip>
                  <Button loading variant={variant}>
                    Saving
                  </Button>
                </Row>
              ))}
              <Row label="Icon only">
                <Button aria-label="Add" iconOnly size="sm" variant="secondary">
                  <Plus aria-hidden="true" />
                </Button>
                <Button aria-label="Add" iconOnly variant="secondary">
                  <Plus aria-hidden="true" />
                </Button>
                <Button aria-label="Add" iconOnly size="lg" variant="secondary">
                  <Plus aria-hidden="true" />
                </Button>
                <Button aria-label="Confirm" iconOnly variant="ghost">
                  <Check aria-hidden="true" />
                </Button>
                <Button aria-label="Saving" iconOnly loading variant="primary">
                  <Check aria-hidden="true" />
                </Button>
              </Row>
              <Row label="Link button">
                <LinkButton href="/submissions">Internal link</LinkButton>
                <LinkButton href="/submissions" variant="plain">
                  Next to review: CY8C5668AXI-LP010
                  <ArrowRight aria-hidden="true" />
                </LinkButton>
                <LinkButton
                  external
                  href="https://www.ti.com/lit/ds/symlink/ne555.pdf"
                  variant="ghost"
                >
                  Vendor PDF
                </LinkButton>
              </Row>
            </Card>
          </Section>

          <Section
            description="12/500, sentence case, soft fill with tone text."
            id="badges"
            title="Badges"
          >
            <Card>
              <Row label="Medium">
                {badgeTones.map((tone) => (
                  <Badge key={tone} tone={tone}>
                    {tone[0].toUpperCase() + tone.slice(1)}
                  </Badge>
                ))}
              </Row>
              <Row label="Small with dot">
                {badgeTones.map((tone) => (
                  <Badge dot key={tone} size="sm" tone={tone}>
                    {tone === "success"
                      ? "Reviewed"
                      : tone === "warning"
                        ? "In progress"
                        : tone === "danger"
                          ? "Mismatch"
                          : tone === "accent"
                            ? "Running"
                            : "Not started"}
                  </Badge>
                ))}
              </Row>
              <Row label="With icon">
                <Badge icon={<Sparkles />} tone="accent">
                  AI flagged 3
                </Badge>
                <Badge icon={<TriangleAlert />} tone="warning">
                  Low confidence
                </Badge>
                <Badge size="sm">9</Badge>
              </Row>
            </Card>
          </Section>

          <Section
            description="Controls use controlSize (md 32 px, lg 36 px) and grow to 44 px on touch screens."
            id="forms"
            title="Forms"
          >
            <Card>
              <PreviewDemos section="forms" />
              <Row label="Number and file">
                <Field
                  className="w-40"
                  hint="At least 1."
                  htmlFor="demo-pins"
                  label="Pin count"
                >
                  <NumberField defaultValue={8} id="demo-pins" min={1} />
                </Field>
                <Field
                  className="min-w-0 flex-1"
                  hint="Legacy input; intake uses its own drop zone."
                  htmlFor="demo-file"
                  label="Datasheet PDF"
                >
                  <FileField accept="application/pdf" id="demo-file" />
                </Field>
              </Row>
              <Row label="Checkbox">
                <Checkbox defaultChecked label="Include re-runs" />
                <Checkbox
                  hint="Only rows the AI marked as unsure."
                  label="Flagged only"
                />
                <Checkbox aria-label="Unlabelled checkbox" />
                <Checkbox defaultChecked disabled label="Disabled" />
              </Row>
              <Row label="Switch">
                <Switch defaultChecked label="Follow active row" />
                <Switch
                  hint="Opens the PDF next to the values."
                  label="Show datasheet"
                />
                <Switch disabled label="Disabled" />
              </Row>
            </Card>
          </Section>

          <Section
            description="Native radios underneath, so arrow keys move the selection."
            id="segmented"
            title="Segmented control"
          >
            <Card>
              <PreviewDemos section="segmented" />
            </Card>
          </Section>

          <Section
            description="Dialogs use native <dialog> with showModal(). Menus and popovers use popover=auto."
            id="overlays"
            title="Overlays"
          >
            <Card>
              <PreviewDemos section="overlays" />
            </Card>
          </Section>

          <Section id="feedback" title="Feedback">
            <Card>
              <PreviewDemos section="feedback" />
              <Row label="Callout tones">
                <div className="grid w-full gap-3">
                  {calloutTones.map((callout) => (
                    <Callout
                      key={callout.tone}
                      title={callout.title}
                      tone={callout.tone}
                    >
                      {callout.body}
                    </Callout>
                  ))}
                  <Callout icon={false} tone="neutral">
                    A plain note without an icon or title.
                  </Callout>
                </div>
              </Row>
              <Row label="Progress bar">
                <div className="grid w-full gap-4">
                  <div className="space-y-1.5">
                    <p className="text-caption text-text-muted">
                      Hairline · 12 of 19 decided
                    </p>
                    <ProgressBar
                      label="Review progress"
                      segments={[
                        { tone: "success", value: 9 },
                        { tone: "danger", value: 3 },
                      ]}
                      total={19}
                      valueText="12 of 19 decided"
                      variant="hairline"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-caption text-text-muted">
                      Small · upload 3.1 of 8.4 MB
                    </p>
                    <ProgressBar
                      label="Upload"
                      segments={[{ tone: "accent", value: 3.1 }]}
                      total={8.4}
                      variant="sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-caption text-text-muted">
                      Medium · agreement 31 match, 4 partial, 3 differ
                    </p>
                    <ProgressBar
                      label="Agreement"
                      segments={[
                        { tone: "success", value: 31 },
                        { tone: "warning", value: 4 },
                        { tone: "danger", value: 3 },
                        { tone: "neutral", value: 2 },
                      ]}
                      total={40}
                      variant="md"
                    />
                  </div>
                </div>
              </Row>
              <Row label="Spinner">
                <Spinner />
                <Spinner size={20} />
                <Spinner label="Loading submissions" />
                <span className="inline-flex items-center gap-2 text-callout text-text-muted">
                  <Spinner size={14} /> Reading the datasheet · 0:14
                </span>
              </Row>
              <Row label="Keyboard">
                <span className="inline-flex items-center gap-1.5 text-callout text-text-muted">
                  Save <Kbd>⌘S</Kbd>
                </span>
                <span className="inline-flex items-center gap-1.5 text-callout text-text-muted">
                  Next row <Kbd>J</Kbd>
                </span>
                <span className="inline-flex items-center gap-1.5 text-callout text-text-muted">
                  Search <Kbd>/</Kbd>
                </span>
              </Row>
            </Card>
          </Section>

          <Section id="data" title="Data display">
            <StatGroup>
              <Stat
                caption="13 baselines"
                label="Reviewed accuracy"
                tone="success"
                value="96%"
              />
              <Stat
                caption="Across 22 runs"
                label="Mean agreement"
                tone="warning"
                value="88%"
              />
              <Stat label="Median latency" value="19.4 s" />
              <Stat caption="Last 30 days" label="Spend" value="$4.18" />
            </StatGroup>
            <StatGroup>
              <Stat label="Needs review" value="9" />
              <Stat label="In progress" value="2" />
              <Stat label="Reviewed" tone="success" value="4" />
            </StatGroup>
            <Card className="overflow-hidden" padding="none">
              <Table caption="Model leaderboard, default density">
                <THead>
                  <Tr>
                    <Th>Model</Th>
                    <Th>Effort</Th>
                    <Th numeric>Runs</Th>
                    <Th numeric>Accuracy</Th>
                    <Th numeric>Median latency</Th>
                    <Th numeric>Cost per run</Th>
                  </Tr>
                </THead>
                <TBody>
                  <Tr>
                    <Td className="font-medium whitespace-nowrap">
                      GPT-5.6 Terra
                    </Td>
                    <Td>High</Td>
                    <Td numeric>13</Td>
                    <Td numeric>
                      <Badge dot size="sm" tone="success">
                        96%
                      </Badge>
                    </Td>
                    <Td numeric>19.4 s</Td>
                    <Td numeric>$0.22</Td>
                  </Tr>
                  <Tr selected>
                    <Td className="font-medium whitespace-nowrap">
                      GPT-5.6 Sol
                    </Td>
                    <Td>Medium</Td>
                    <Td numeric>6</Td>
                    <Td numeric>
                      <Badge dot size="sm" tone="warning">
                        88%
                      </Badge>
                    </Td>
                    <Td numeric>12.1 s</Td>
                    <Td numeric>$0.09</Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium whitespace-nowrap">GPT-5.4</Td>
                    <Td>Low</Td>
                    <Td numeric>3</Td>
                    <Td numeric>
                      <Badge dot size="sm" tone="danger">
                        71%
                      </Badge>
                    </Td>
                    <Td numeric>8.0 s</Td>
                    <Td numeric>$0.04</Td>
                  </Tr>
                </TBody>
              </Table>
            </Card>
            <Card className="overflow-hidden" padding="none">
              <Table
                caption="Pins, compact density"
                captionVisible
                density="compact"
              >
                <THead>
                  <Tr>
                    <Th numeric>Pin</Th>
                    <Th>Name</Th>
                    <Th>Function</Th>
                    <Th>Decision</Th>
                  </Tr>
                </THead>
                <TBody>
                  {[
                    ["1", "GND", "Ground reference", "Confirmed"],
                    ["2", "TRIG", "Trigger input", "Confirmed"],
                    ["3", "OUT", "Output", "Corrected"],
                    ["4", "RESET", "Active-low reset", "Pending"],
                  ].map(([pin, name, fn, decision]) => (
                    <Tr key={pin}>
                      <Td className="font-mono text-callout" numeric>
                        {pin}
                      </Td>
                      <Td className="font-mono text-callout">{name}</Td>
                      <Td>{fn}</Td>
                      <Td>
                        <Badge
                          size="sm"
                          tone={
                            decision === "Confirmed"
                              ? "success"
                              : decision === "Corrected"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {decision}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="space-y-3">
                <h3 className="text-title-3">Description list, columns</h3>
                <DescriptionList
                  items={[
                    {
                      copyValue: "NE555DR",
                      term: "Part number",
                      value: <span className="font-mono">NE555DR</span>,
                    },
                    { term: "Category", value: "Small Outline Packages" },
                    {
                      href: "https://www.ti.com/lit/ds/symlink/ne555.pdf",
                      term: "Source",
                      value: "ti.com · ne555.pdf",
                    },
                    {
                      href: "/submissions",
                      term: "Baseline",
                      value: "Open baseline review",
                    },
                  ]}
                />
              </Card>
              <Card className="space-y-3">
                <h3 className="text-title-3">Description list, stacked</h3>
                <DescriptionList
                  items={[
                    { term: "Model", value: "GPT-5.6 Terra · High" },
                    {
                      term: "Run",
                      value: "19.4 s · 18,204 tokens · $0.22 est.",
                    },
                  ]}
                  layout="stacked"
                />
                <Disclosure summary="How these numbers work">
                  Accuracy counts confirmed decisions over all decided rows.
                  Agreement compares a re-run with its reviewed baseline.
                </Disclosure>
                <Disclosure defaultOpen summary="Details (open by default)">
                  OpenAI response id resp_0a1b2c3d.
                </Disclosure>
              </Card>
            </div>
          </Section>

          <Section id="states" title="Empty and loading">
            <div className="grid gap-4 md:grid-cols-2">
              <Card padding="none">
                <EmptyState
                  action={
                    <LinkButton href="/" variant="primary">
                      <FilePlus2 aria-hidden="true" />
                      New extraction
                    </LinkButton>
                  }
                  description="Extract a datasheet to start building the review queue."
                  icon={<Inbox />}
                  title="No submissions yet"
                  titleAs="h3"
                />
              </Card>
              <Card padding="none">
                <EmptyState
                  description="Try a different part number or clear the filters."
                  icon={<FileSearch />}
                  title="No matches"
                  titleAs="h3"
                />
              </Card>
            </div>
            <Card className="space-y-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <SkeletonText lines={3} />
            </Card>
          </Section>
        </div>
      </div>
    </ToastProvider>
  );
}
