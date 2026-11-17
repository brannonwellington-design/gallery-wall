import { NextResponse } from "next/server";
import { deleteUnreferencedRoomImages, externalizeRoomImages } from "@/lib/imageStore";
import { getRepo, RoomConflictError, RoomNotFoundError } from "@/lib/repo";
import { withLegacyImageFields } from "@/lib/roomMigrations";
import { isSafeId, parseRoom } from "@/lib/roomSchema";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Reads are side-effect free. Inline images left over from older rooms are
// moved to Storage the next time the room is saved (see PATCH).
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const record = isSafeId(id) ? await getRepo().get(id) : null;
    if (!record) return jsonError("Not found", 404);
    return NextResponse.json({ room: record.room, updatedAt: record.updatedAt });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isSafeId(id)) return jsonError("Room not found", 404);

  const body = await readJson<{ room?: unknown; baseUpdatedAt?: unknown }>(req);
  if (!body) return jsonError("Invalid JSON body", 400);
  const parsed = parseRoom(body.room);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const baseUpdatedAt =
    typeof body.baseUpdatedAt === "string" ? body.baseUpdatedAt : undefined;

  try {
    const { room } = await externalizeRoomImages(id, parsed.room);
    const { updatedAt } = await getRepo().update(id, room, {
      expectedUpdatedAt: baseUpdatedAt,
    });
    return NextResponse.json({ ok: true, updatedAt, room: withLegacyImageFields(room) });
  } catch (e) {
    if (e instanceof RoomNotFoundError) return jsonError(e.message, 404);
    if (e instanceof RoomConflictError) {
      return NextResponse.json(
        { error: e.message, conflict: true, currentUpdatedAt: e.currentUpdatedAt },
        { status: 409 },
      );
    }
    return jsonError(errorMessage(e), 500);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isSafeId(id)) return jsonError("Room not found", 404);
    const repo = getRepo();
    await repo.remove(id);
    // Best-effort: free the room's stored images. Files another room still
    // points at (e.g. an older duplicate) are kept. A failure here leaves
    // orphaned files but never blocks the delete.
    try {
      const remaining = (await repo.allRooms()).map((r) => r.room);
      await deleteUnreferencedRoomImages(id, remaining);
    } catch (e) {
      console.error("[rooms] image cleanup failed", id, e);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}
