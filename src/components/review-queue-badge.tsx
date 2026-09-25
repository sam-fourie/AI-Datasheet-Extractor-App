import { connection } from "next/server";

import { Badge, Tooltip } from "@/components/ui";
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
    <Tooltip content={label} describeChild={false} side="right">
      <Badge className="ml-auto" size="sm" tone="neutral">
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">, {label}</span>
      </Badge>
    </Tooltip>
  );
}
