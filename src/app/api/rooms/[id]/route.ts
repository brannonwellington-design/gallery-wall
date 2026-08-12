import { NextResponse } from "next/server";
import { externalizeRoomImages } from "@/lib/imageStore";
import { getRepo } from "@/lib/repo";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const record = await getRepo().get(id);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { room, changed } = await externalizeRoomImages(id, record.room);
    let updatedAt = record.updatedAt;
    if (changed) {
      ({ updatedAt } = await getRepo().update(id, room));
    }

    return NextResponse.json({ room, updatedAt });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { room?: Room };
    if (!body.room || !isRoom(body.room)) {
      return NextResponse.json({ error: "Invalid room body" }, { status: 400 });
    }
    try {
      const { room } = await externalizeRoomImages(id, body.room);
      const { updatedAt } = await getRepo().update(id, room);
      return NextResponse.json({ ok: true, updatedAt, room });
    } catch (e) {
      const msg = errorMessage(e);
      if (msg === "Room not found") {
        return NextResponse.json({ error: msg }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await getRepo().remove(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function isRoom(v: unknown): v is Room {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.name === "string" &&
    typeof r.wallWidth === "number" &&
    typeof r.wallHeight === "number" &&
    (r.unit === "in" || r.unit === "cm") &&
    Array.isArray(r.items)
  );
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}
