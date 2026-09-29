import type { Metadata } from "next";
import { FileSearch } from "lucide-react";

import { PinEntry } from "@/components/unlock/pin-entry";
import { APP_PIN, safeNextPath, UNLOCK_API_PATH } from "@/lib/auth";

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
 * The PIN screen. The root layout renders it without the app shell. Only the
 * PIN's length reaches the client: the boxes check it through /api/unlock.
 */
export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  const failed = firstValue(params.error) === "1";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pt-16 pb-28">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-md bg-accent text-white"
      >
        <FileSearch className="size-8" strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-title-1 text-text">Enter PIN</h1>
      <p className="mt-1 text-body text-text-muted">AI Datasheet Extractor</p>
      <div className="mt-10">
        <PinEntry action={UNLOCK_API_PATH} failed={failed} length={APP_PIN.length} next={next} />
      </div>
    </div>
  );
}
