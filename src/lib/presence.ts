// Who's in a room right now. Each open editor checks in every few seconds;
// entries expire after PRESENCE_TTL_MS without a check-in. Shared types and
// pure helpers — the store lives in the presence route.

export type PresenceEntry = {
  sessionId: string;
  name: string;
  color: string;
  /** Piece ids this person has selected. */
  selection: string[];
  /** ms since epoch of the last check-in. */
  seen: number;
};

export const PRESENCE_TTL_MS = 15_000;

/** Distinct, brand-friendly colors for other people's cursors/selections. */
const COLORS = ["#0021CC", "#B85814", "#0F8A38", "#B82214", "#6B4FBB", "#B88114", "#0E7C86", "#C2185B"];

export function colorFor(sessionId: string): string {
  let h = 0;
  for (const ch of sessionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Drop stale entries, then upsert or remove `me`. */
export function updatePresence(
  entries: Record<string, PresenceEntry>,
  me: PresenceEntry | null,
  leavingId: string | null,
  now: number,
): Record<string, PresenceEntry> {
  const next: Record<string, PresenceEntry> = {};
  for (const [id, e] of Object.entries(entries)) {
    if (now - e.seen < PRESENCE_TTL_MS && id !== leavingId) next[id] = e;
  }
  if (me) next[me.sessionId] = me;
  return next;
}
