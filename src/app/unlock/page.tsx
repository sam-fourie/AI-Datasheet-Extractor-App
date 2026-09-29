import type { Metadata } from "next";
import { FileSearch } from "lucide-react";

import { Button, Card, Field, TextField } from "@/components/ui";
import { safeNextPath, UNLOCK_API_PATH } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Enter PIN",
};

type UnlockPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The PIN screen. The root layout renders it without the app shell, and the
 * form is a plain POST to /api/unlock, so it needs no client JavaScript.
 */
export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  const failed = firstValue(params.error) === "1";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[360px]" padding="lg">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-sm bg-accent text-white"
          >
            <FileSearch className="size-5" strokeWidth={2.25} />
          </span>
          <h1 className="mt-4 text-title-3 text-text">AI Datasheet Extractor</h1>
          <p className="mt-1 text-callout text-text-muted">Enter the PIN to continue.</p>
        </div>
        <form action={UNLOCK_API_PATH} className="mt-6 space-y-4" method="post">
          <input name="next" type="hidden" value={next} />
          <Field error={failed ? "That PIN isn't right. Try again." : undefined} label="PIN">
            <TextField
              autoComplete="current-password"
              autoFocus
              controlSize="lg"
              id="unlock-pin"
              inputMode="numeric"
              name="pin"
              required
              type="password"
            />
          </Field>
          <Button className="w-full" size="lg" type="submit" variant="primary">
            Unlock
          </Button>
        </form>
      </Card>
    </div>
  );
}
