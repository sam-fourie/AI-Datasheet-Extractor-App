import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FileSearch } from "lucide-react";

import { UnlockFlow } from "@/components/unlock/unlock-flow";
import {
  APP_PIN,
  IDENTITY_API_PATH,
  isUnlockToken,
  safeNextPath,
  UNLOCK_API_PATH,
  UNLOCK_COOKIE_NAME,
} from "@/lib/auth";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Sign in",
};

type UnlockPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The sign-in screen: the PIN, then "Who is this?" when the device has no
 * name. The proxy only lets visitors here until they have both, so an
 * unlocked visitor starts at the name step. The root layout renders it
 * without the app shell. Only the PIN's length reaches the client.
 */
export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const params = await searchParams;
  const next = safeNextPath(firstValue(params.next));
  const failed = firstValue(params.error) === "1";
  const unlocked = isUnlockToken((await cookies()).get(UNLOCK_COOKIE_NAME)?.value);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pt-16 pb-28">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-md bg-accent text-white"
      >
        <FileSearch className="size-8" strokeWidth={2} />
      </span>
      <div className="mt-6">
        <UnlockFlow
          failed={failed}
          identityAction={IDENTITY_API_PATH}
          initialStep={unlocked ? "name" : "pin"}
          next={next}
          pinAction={UNLOCK_API_PATH}
          pinLength={APP_PIN.length}
        />
      </div>
    </div>
  );
}
