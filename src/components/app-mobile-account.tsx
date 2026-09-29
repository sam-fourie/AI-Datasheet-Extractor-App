"use client";

import { LogOut } from "lucide-react";

import { AccountAvatar } from "@/components/account-avatar";
import { Button, Popover } from "@/components/ui";

export type AppMobileAccountProps = {
  /** `LOGOUT_API_PATH`. */
  logoutAction: string;
  name: string;
};

/**
 * The account button at the end of the mobile top bar: the person's initials,
 * opening a small panel with their name and Log out (a plain form post, like
 * the desktop sidebar's).
 */
export function AppMobileAccount({ logoutAction, name }: AppMobileAccountProps) {
  return (
    <Popover
      align="end"
      label="Account"
      trigger={
        <button
          aria-label={`Account: ${name}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-pill pointer-coarse:size-11"
          type="button"
        >
          <AccountAvatar name={name} />
        </button>
      }
      width={248}
    >
      <div className="flex items-center gap-3">
        <AccountAvatar name={name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-text">{name}</p>
          <p className="text-caption text-text-muted">Signed in on this device</p>
        </div>
      </div>
      <form action={logoutAction} className="mt-4" method="post">
        <Button className="w-full" type="submit" variant="secondary">
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </form>
    </Popover>
  );
}
