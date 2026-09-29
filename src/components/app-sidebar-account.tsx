import { LogOut } from "lucide-react";

import { AccountAvatar } from "@/components/account-avatar";
import { SIDEBAR_REVEAL_CLASS_NAME } from "@/components/app-sidebar-classes";
import { IconButton, cn } from "@/components/ui";

export type SidebarAccountProps = {
  /** `LOGOUT_API_PATH`. */
  logoutAction: string;
  name: string;
};

/**
 * The bottom of the desktop sidebar: the signed-in person's initials, and on
 * the widened panel their name and Log out. Log out is a plain form post, so
 * the browser follows the redirect to the PIN screen with a full page load,
 * and the review workspace's unsaved-changes warning still applies.
 */
export function SidebarAccount({ logoutAction, name }: SidebarAccountProps) {
  return (
    <form action={logoutAction} className="flex h-10 shrink-0 items-center gap-2.5 px-1.5" method="post">
      <AccountAvatar name={name} />
      <span
        className={cn("min-w-0 flex-1 truncate text-callout font-medium text-text", SIDEBAR_REVEAL_CLASS_NAME)}
        title={name}
      >
        {name}
      </span>
      <IconButton
        className={SIDEBAR_REVEAL_CLASS_NAME}
        icon={<LogOut />}
        label="Log out"
        size="sm"
        type="submit"
        variant="ghost"
      />
    </form>
  );
}
