import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rooms = await getRepo().list();
    return NextResponse.json({ rooms });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Body is optional. When { sourceId } is supplied, the new room is
    // seeded from that source's contents — same wall, same pieces, same
    // unit, etc. — and named "Copy of <original>".
    let sourceId: string | null = null;
    try {
      const body = (await req.json()) as { sourceId?: string };
      if (typeof body?.sourceId === "string" && body.sourceId.length > 0) {
        sourceId = body.sourceId;
      }
    } catch {
      // No body / non-JSON — treat as a regular blank create.
    }

    const repo = getRepo();
    if (sourceId) {
      const src = await repo.get(sourceId);
      if (!src) {
        return NextResponse.json({ error: "Source room not found" }, { status: 404 });
      }
      const { id } = await repo.create({
        ...src.room,
        name: `Copy of ${src.room.name || "Untitled room"}`,
      });
      return NextResponse.json({ id }, { status: 201 });
    }

    const { id } = await repo.create();
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}
