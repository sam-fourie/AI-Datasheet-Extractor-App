import { Card, cn } from "@/components/ui";

const ROW_COUNT = 8;

/** A skeleton block. Not the ui Skeleton: its default h-4 can't be overridden through cn. */
function Bone({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-xs bg-surface-muted motion-safe:animate-pulse", className)}
    />
  );
}

/** Matches ReviewSection's header row (min-h-7, mb-3) so the cards start at the same offset. */
function SectionHeading({ className }: { className: string }) {
  return (
    <div className="mb-3 flex min-h-7 items-center">
      <Bone className={cn("h-5", className)} />
    </div>
  );
}

/**
 * Review workspace skeleton (§4.3): the same sticky header, toolbar, values
 * column and (at xl) datasheet pane frame as the loaded page, so nothing
 * jumps when it arrives.
 */
export default function SubmissionReviewLoading() {
  return (
    <div className="relative min-w-0 max-md:[--ui-header-height:52px] max-md:[--ui-toolbar-height:44px]">
      <p className="sr-only" role="status">
        Loading submission…
      </p>

      <div
        aria-hidden="true"
        className="sticky top-0 z-30 flex h-(--ui-header-height) items-center gap-2 border-b border-border bg-material px-2 backdrop-blur-[20px] sm:px-3 lg:px-4"
      >
        <Bone className="size-8 rounded-sm!" />
        <Bone className="h-5 w-32 sm:w-40" />
        <Bone className="h-6 w-24 max-md:hidden" />
        <Bone className="h-4 w-72 max-xl:hidden" />
        <div className="flex-1" />
        <Bone className="h-7 w-48 max-md:hidden" />
        <Bone className="size-7 rounded-sm!" />
        <Bone className="h-7 w-24 rounded-sm! max-md:hidden" />
      </div>

      <div className="min-w-0 xl:grid xl:grid-cols-[minmax(0,1fr)_clamp(420px,44%,760px)]">
        <div className="min-w-0" aria-hidden="true">
          <div className="sticky top-(--ui-header-height) z-20 flex h-(--ui-toolbar-height) items-center gap-4 border-b border-border bg-material pr-3 pl-4 backdrop-blur-[20px] md:pr-4 xl:pl-6">
            <Bone className="h-3.5 w-14" />
            <Bone className="h-3.5 w-24" />
            <Bone className="h-3.5 w-12" />
            <Bone className="h-3.5 w-12 max-sm:hidden" />
            <div className="flex-1" />
            <Bone className="h-7 w-24 rounded-sm! max-md:hidden" />
            <Bone className="h-7 w-24 rounded-sm! max-md:hidden" />
            <Bone className="h-7 w-16 rounded-sm! max-md:hidden" />
            <Bone className="size-8 rounded-sm! md:hidden" />
          </div>

          <div className="mx-auto flex w-full max-w-[840px] flex-col gap-8 px-4 pt-5 pb-28 sm:px-6 md:pt-6 md:pb-16 xl:max-w-(--ui-content-review)">
            {/* Mobile intro (status badge, meta line, run switcher), as in ReviewWorkspace. */}
            <div className="space-y-3 md:hidden">
              <Bone className="h-6 w-28 rounded-pill!" />
              <Bone className="h-[18px] w-64 max-w-full" />
              <Bone className="h-11 w-full rounded-sm!" />
            </div>

            <div>
              <SectionHeading className="w-28" />
              <Card
                className="flex min-h-[90px] items-center gap-3 px-4 max-md:min-h-[108px]"
                padding="none"
              >
                <Bone className="size-5 rounded-pill!" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bone className="h-4 w-48 max-w-full" />
                  <Bone className="h-3 w-64 max-w-full" />
                  <Bone className="h-3 w-16 md:hidden" />
                </div>
                <Bone className="h-[30px] w-16 rounded-sm!" />
              </Card>
            </div>

            <div>
              <SectionHeading className="w-36" />
              <Card className="overflow-hidden" padding="none">
                {Array.from({ length: ROW_COUNT }, (_, index) => (
                  // Same heights as the real measurement rows: name + meta line
                  // (64 px) at md+, name / value / evidence lines (98 px) below.
                  <div
                    className={cn(
                      "relative flex h-16 flex-col justify-center gap-2 px-4 max-md:h-[98px]",
                      index > 0 &&
                        "before:absolute before:top-0 before:right-0 before:left-11 before:h-px before:bg-border-subtle",
                    )}
                    key={index}
                  >
                    <div className="flex items-center gap-3">
                      <Bone className="size-5 rounded-pill!" />
                      <Bone className="h-3.5 w-28 md:w-36" />
                      <Bone className="h-3.5 w-24 max-md:hidden md:ml-8" />
                      <div className="flex-1" />
                      <Bone className="h-[30px] w-16 rounded-sm!" />
                    </div>
                    <Bone className="ml-8 h-3.5 w-24 md:hidden" />
                    <Bone className="ml-8 h-5 w-12 rounded-sm! md:hidden" />
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="sticky top-(--ui-header-height) hidden h-[calc(100dvh-var(--ui-header-height))] self-start border-l border-border bg-surface-sunken xl:flex xl:flex-col"
        >
          <div className="h-10 shrink-0 border-b border-border bg-surface-subtle" />
          <div className="flex-1 pt-2 pl-2">
            <div className="size-full rounded-tl-md bg-surface/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
