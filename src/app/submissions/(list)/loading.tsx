import { appPageContainerClassName } from "@/components/app-page-layout";
import {
  toolbarContainerClassName,
  toolbarRowClassName,
  toolbarSearchClassName,
  toolbarTrailingClassName,
} from "@/components/submissions/toolbar-layout";
import { Card, cn, Skeleton } from "@/components/ui";

const ROW_COUNT = 8;

export default function SubmissionsLoading() {
  return (
    <div className={appPageContainerClassName("full")}>
      <p className="sr-only" role="status">
        Loading submissions…
      </p>
      <div
        aria-hidden="true"
        className="flex flex-col gap-4 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between lg:pt-8 lg:pb-6"
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-7 w-36 rounded-sm pointer-coarse:h-11" />
      </div>
      {/* gap-6 matches AppPageLayout's body gap between toolbar and list. */}
      <div aria-hidden="true" className="flex flex-col gap-6 pb-12">
        {/* Same wrap rules as SubmissionsToolbar, so the list does not jump. */}
        <div className={toolbarContainerClassName}>
          <div className={toolbarRowClassName}>
            <Skeleton className={cn("h-8 rounded-sm pointer-coarse:h-11", toolbarSearchClassName)} />
            <Skeleton className="h-9 w-full rounded-sm pointer-coarse:h-12 md:w-73" />
            <div className={toolbarTrailingClassName}>
              <Skeleton className="h-8 rounded-sm pointer-coarse:h-11 md:w-48" />
              <Skeleton className="h-8 rounded-sm pointer-coarse:h-11 md:w-45" />
            </div>
          </div>
        </div>
        <Card className="overflow-clip" padding="none">
          <div className="h-9 border-b border-border bg-surface-subtle max-md:hidden" />
          {Array.from({ length: ROW_COUNT }, (_, index) => (
            <div
              className="flex h-17 items-center gap-6 border-b border-border-subtle px-4 last:border-b-0 md:h-15"
              key={index}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-3.5 w-24 max-md:hidden" />
              <Skeleton className="h-3.5 w-16 max-md:hidden" />
              <Skeleton className="h-3.5 w-20 max-xl:hidden" />
              <Skeleton className="h-3.5 w-14 max-md:hidden" />
              <Skeleton className="size-6" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
