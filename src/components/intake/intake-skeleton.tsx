import { Card, Skeleton } from "@/components/ui";

/** The intake header copy, shared by the page and its route-level loading state. */
export const INTAKE_PAGE_TITLE = "New extraction";
export const INTAKE_PAGE_META =
  "Drop a datasheet and we'll extract the package dimensions, pin map and package variant for you to review.";

function FieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={`h-4.5 ${labelWidth}`} />
      <Skeleton className="h-9 w-full rounded-sm pointer-coarse:h-11" />
    </div>
  );
}

/**
 * Placeholder for the intake card and Recent extractions while the datasheet
 * index and model benchmarks load. Matches the form's field rhythm so the
 * real form swaps in without a layout jump. Server-safe.
 */
export function IntakeSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading…
      </p>
      <Card aria-busy="true" padding="lg">
        <div aria-hidden="true" className="space-y-5">
          <div className="space-y-3">
            <Skeleton className="mb-1.5 h-4.5 w-20" />
            <Skeleton className="h-[132px] w-full rounded-md sm:h-40" />
            <Skeleton className="mx-auto h-4 w-28" />
            <Skeleton className="h-9 w-full rounded-sm pointer-coarse:h-11" />
          </div>
          <FieldSkeleton labelWidth="w-24" />
          <FieldSkeleton labelWidth="w-36" />
          <div className="border-t border-border-subtle pt-5">
            <Skeleton className="h-5 w-64 max-w-full" />
            <Skeleton className="mt-2 h-4 w-40 sm:hidden" />
          </div>
          <div className="space-y-3 pt-1">
            <Skeleton className="h-4.5 w-72 max-w-full" />
            <Skeleton className="h-10 w-full rounded-sm" />
          </div>
        </div>
      </Card>
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="mx-1 h-4.5 w-36" />
        <Card className="overflow-hidden" padding="none">
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex min-h-11 items-center gap-3 px-4 py-2.5" key={index}>
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-14 max-[359px]:hidden" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
