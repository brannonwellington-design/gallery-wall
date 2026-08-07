import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const room = await getRepo().get(id);
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ room });
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
      await getRepo().update(id, body.room);
    } catch (e) {
      const msg = errorMessage(e);
      if (msg === "Room not found") {
        return NextResponse.json({ error: msg }, { status: 404 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
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
