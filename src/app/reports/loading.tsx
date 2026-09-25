import { AppPageLayout } from "@/components/app-page-layout";
import { Card, Skeleton, SkeletonText } from "@/components/ui";

/** Header, filter bar, the five stats and two chart cards (spec §4.4). */
export default function ReportsLoading() {
  return (
    <AppPageLayout meta={<Skeleton className="h-4 w-72 max-w-full" />} title="Reports">
      <div aria-busy="true" className="flex min-w-0 flex-col gap-10 lg:gap-12">
        <span className="sr-only" role="status">
          Loading reports
        </span>
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full rounded-sm sm:w-64" />
          <Skeleton className="h-8 flex-1 basis-36 rounded-sm sm:w-44 sm:flex-none" />
          <Skeleton className="h-8 flex-1 basis-36 rounded-sm sm:w-36 sm:flex-none" />
          <Skeleton className="h-8 w-full rounded-sm sm:w-52" />
        </div>
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border shadow-card xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                className="flex flex-col gap-2 bg-surface px-5 py-4 last:col-span-2 xl:last:col-span-1"
                key={index}
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-44" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <Card key={index}>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-3.5 w-56 max-w-full" />
                <Skeleton className="mt-6 h-40 w-full" />
                <SkeletonText className="mt-4" lines={2} />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppPageLayout>
  );
}
