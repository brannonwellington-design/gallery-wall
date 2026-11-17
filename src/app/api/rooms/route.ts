import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { isSafeId } from "@/lib/roomSchema";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rooms = await getRepo().list();
    return NextResponse.json({ rooms });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}

export async function POST(req: Request) {
  try {
    // Body is optional. When { sourceId } is supplied, the new room is
    // seeded from that source's contents — same wall, same pieces, same
    // unit, etc. — and named "Copy of <original>".
    const body = await readJson<{ sourceId?: unknown }>(req);
    const sourceId = body?.sourceId;

    const repo = getRepo();
    if (sourceId !== undefined) {
      const src = isSafeId(sourceId) ? await repo.get(sourceId) : null;
      if (!src) return jsonError("Source room not found", 404);
      const { id } = await repo.create({
        ...src.room,
        name: `Copy of ${src.room.name || "Untitled room"}`,
      });
      return NextResponse.json({ id }, { status: 201 });
    }

    const { id } = await repo.create();
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}
