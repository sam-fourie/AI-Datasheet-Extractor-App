import { connection } from "next/server";

import { SIDEBAR_REVEAL_CLASS_NAME } from "@/components/app-sidebar-classes";
import { Badge, cn, Tooltip } from "@/components/ui";
import { getReviewQueueCount } from "@/lib/submissions/repository";

function pluralizeDatasheets(count: number) {
  return count === 1 ? "1 datasheet needs review" : `${count} datasheets need review`;
}

/**
 * Sidebar count of baselines that still need review (spec §1.3). Server only;
 * render it inside `<Suspense fallback={null}>`. Hidden at 0 and on any
 * database error.
 */
export async function ReviewQueueBadge() {
  // Never evaluate at build time: the count is live data.
  await connection();

  let count: number;

  try {
    count = await getReviewQueueCount();
  } catch (error) {
    console.error("Failed to load the review queue count.", error);
    return null;
  }

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  const label = pluralizeDatasheets(count);

  return (
    <>
      {/* Collapsed rail: a dot on the Submissions icon. It fades out as the
          panel expands and the numbered pill takes over. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 left-[26px] size-2 rounded-pill bg-accent ring-2 ring-surface-subtle transition-opacity duration-(--ui-duration-fast) ease-ui group-hover/sidebar:opacity-0 group-hover/sidebar:delay-150 group-has-[:focus-visible]/sidebar:opacity-0 group-has-[:focus-visible]/sidebar:delay-0"
      />
      <Tooltip content={label} describeChild={false} side="right">
        <Badge className={cn("ml-auto", SIDEBAR_REVEAL_CLASS_NAME)} size="sm" tone="neutral">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">, {label}</span>
        </Badge>
      </Tooltip>
    </>
  );
}
