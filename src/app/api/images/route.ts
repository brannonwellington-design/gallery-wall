import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "room-images";

/**
 * Upload a single data-URL image to Storage. Used by the client when a
 * room PATCH would exceed Vercel's body limit — images go up one at a
 * time, then the lean room JSON is saved.
 */
export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Image storage is not configured" },
        { status: 503 },
      );
    }

    const body = (await req.json()) as {
      roomId?: string;
      itemId?: string;
      kind?: "main" | "original";
      dataUrl?: string;
    };
    if (
      !body.roomId ||
      !body.itemId ||
      !body.dataUrl ||
      (body.kind !== "main" && body.kind !== "original")
    ) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (!body.dataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Expected a data:image URL" },
        { status: 400 },
      );
    }

    const m = body.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) {
      return NextResponse.json({ error: "Malformed data URL" }, { status: 400 });
    }
    const contentType = m[1].toLowerCase();
    const bytes = Buffer.from(m[2], "base64");
    // ~6 MB decoded — well under storage limits, keeps one request modest.
    if (bytes.length > 6_000_000) {
      return NextResponse.json(
        { error: "Image is too large to upload" },
        { status: 413 },
      );
    }
    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : contentType === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${body.roomId}/${body.itemId}-${body.kind}.${ext}`;

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
