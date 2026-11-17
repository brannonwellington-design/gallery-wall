import { getCache } from "@vercel/functions";
import { NextResponse } from "next/server";
import { colorFor, updatePresence, type PresenceEntry } from "@/lib/presence";
import { getRepo } from "@/lib/repo";
import { isSafeId } from "@/lib/roomSchema";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Editor check-in (every few seconds): records who's here and what they
 * have selected, and returns everyone else plus the room's current
 * updatedAt so the editor can pull in other people's saves.
 *
 * Presence lives in the Vercel Runtime Cache (short TTL, per region) — it's
 * ephemeral by design. Two check-ins racing can drop one entry for a few
 * seconds; the next check-in restores it.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isSafeId(id)) return jsonError("Room not found", 404);
  const body = await readJson<{
    sessionId?: unknown;
    name?: unknown;
    selection?: unknown;
    leaving?: unknown;
  }>(req);
  if (!body || !isSafeId(body.sessionId)) return jsonError("Invalid body", 400);

  try {
    const updatedAt = await getRepo().version(id);
    if (!updatedAt) return jsonError("Room not found", 404);

    const cache = getCache({ namespace: "presence" });
    const now = Date.now();
    const current = ((await cache.get(id)) as Record<string, PresenceEntry> | undefined) ?? {};
    const leaving = body.leaving === true;
    const me: PresenceEntry | null = leaving
      ? null
      : {
          sessionId: body.sessionId,
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : "Guest",
          color: colorFor(body.sessionId),
          selection: Array.isArray(body.selection)
            ? body.selection.filter(isSafeId).slice(0, 100)
            : [],
          seen: now,
        };
    const next = updatePresence(current, me, leaving ? body.sessionId : null, now);
    await cache.set(id, next, { ttl: 60, name: "room-presence" });

    const others = Object.values(next).filter((e) => e.sessionId !== body.sessionId);
    return NextResponse.json(
      { updatedAt, others },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}
