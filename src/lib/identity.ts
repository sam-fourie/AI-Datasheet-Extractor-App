/**
 * Who is using the app: the name a person gives after the PIN ("Who is
 * this?"). Pure and client-safe. The server keeps the name in the `dx_name`
 * cookie (`src/lib/auth.ts`) and records it on submissions and reviews.
 */

export const ACTOR_NAME_MAX_LENGTH = 60;

/**
 * A usable display name, or null: trimmed, inner whitespace collapsed,
 * control characters removed, at most ACTOR_NAME_MAX_LENGTH characters.
 */
export function normalizeActorName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return null;
  }

  return Array.from(cleaned).slice(0, ACTOR_NAME_MAX_LENGTH).join("").trim();
}

/** "Sam Fourie" → "SF", "Cher" → "C", for the account avatar. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ? Array.from(words[0])[0] : "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";

  return `${first}${last}`.toUpperCase();
}
