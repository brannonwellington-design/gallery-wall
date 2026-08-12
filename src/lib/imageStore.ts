import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Item, Room } from "./types";

const BUCKET = "room-images";

let client: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

function parseDataUrl(dataUrl: string): {
  contentType: string;
  bytes: Buffer;
  ext: string;
} | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  const bytes = Buffer.from(m[2], "base64");
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
          ? "gif"
          : "jpg";
  return { contentType, bytes, ext };
}

async function uploadDataUrl(
  supabase: SupabaseClient,
  roomId: string,
  itemId: string,
  kind: "main" | "original",
  dataUrl: string,
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const path = `${roomId}/${itemId}-${kind}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, parsed.bytes, {
      contentType: parsed.contentType,
      upsert: true,
    });
  if (error) {
    console.error("[image-store] upload failed", path, error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Replace inline `data:` image URLs with Supabase Storage public URLs.
 * Keeps room PATCH bodies under Vercel's ~4.5 MB request limit.
 * No-op when Supabase isn't configured (local file-repo mode).
 */
export async function externalizeRoomImages(
  roomId: string,
  room: Room,
): Promise<{ room: Room; changed: boolean }> {
  const supabase = getStorageClient();
  if (!supabase) return { room, changed: false };

  let changed = false;
  const items: Item[] = [];

  for (const item of room.items) {
    let next = item;

    if (item.imageDataUrl?.startsWith("data:")) {
      const url = await uploadDataUrl(
        supabase,
        roomId,
        item.id,
        "main",
        item.imageDataUrl,
      );
      if (url) {
        next = { ...next, imageDataUrl: url };
        changed = true;
      }
    }

    if (next.imageOriginalDataUrl?.startsWith("data:")) {
      const url = await uploadDataUrl(
        supabase,
        roomId,
        item.id,
        "original",
        next.imageOriginalDataUrl,
      );
      if (url) {
        next = { ...next, imageOriginalDataUrl: url };
        changed = true;
      }
    }

    items.push(next);
  }

  return changed ? { room: { ...room, items }, changed: true } : { room, changed: false };
}
