import { Card } from "@/components/ui";

export default function SubmissionDetailLoading() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8 md:py-12">
      <Card className="space-y-4">
        <div className="h-4 w-32 animate-pulse rounded-pill bg-surface-muted" />
        <div className="h-10 w-64 animate-pulse rounded-control bg-surface-muted" />
        <div className="h-5 w-full max-w-3xl animate-pulse rounded-control bg-surface-muted" />
      </Card>

      <Card className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded-control bg-surface-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-32 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-32 animate-pulse rounded-control bg-surface-muted" />
        </div>
      </Card>
    </section>
  );
}
