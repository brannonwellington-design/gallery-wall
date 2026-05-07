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

export async function POST() {
  try {
    const { id } = await getRepo().create();
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}
