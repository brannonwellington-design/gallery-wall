import "server-only";
import { base64Bytes, parseImageDataUrl } from "./dataUrl";
import { isSafeId } from "./roomSchema";
import { getServiceClient, IMAGE_BUCKET } from "./server/supabase";
import type { Item, Room } from "./types";

/** ~6 MB decoded per image — well under the bucket's 10 MB limit. */
export const MAX_IMAGE_BYTES = 6_000_000;

export type ImageKind = "main" | "original";

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Upload one data-URL image to Storage and return its public URL. The path
 * is built only from validated ids, so callers can't write outside
 * `<roomId>/<itemId>-<kind>.<ext>`.
 */
export async function uploadImage(
  roomId: string,
  itemId: string,
  kind: ImageKind,
  dataUrl: string,
): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase) throw new ImageUploadError("Image storage is not configured", 503);
  if (!isSafeId(roomId) || !isSafeId(itemId)) {
    throw new ImageUploadError("Invalid room or item id", 400);
  }
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    throw new ImageUploadError("Expected a PNG, JPEG, WebP, or GIF data URL", 400);
  }
  if (base64Bytes(parsed.base64) > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("Image is too large to upload", 413);
  }
  const path = `${roomId}/${itemId}-${kind}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, Buffer.from(parsed.base64, "base64"), {
      contentType: parsed.contentType,
      upsert: true,
    });
  if (error) throw new ImageUploadError(error.message, 500);
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
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
  if (!getServiceClient()) return { room, changed: false };

  let changed = false;
  const items: Item[] = [];

  for (const item of room.items) {
    let next = item;
    for (const [field, kind] of [
      ["imageDataUrl", "main"],
      ["imageOriginalDataUrl", "original"],
    ] as const) {
      const value = next[field];
      if (!value?.startsWith("data:")) continue;
      try {
        const url = await uploadImage(roomId, item.id, kind, value);
        next = { ...next, [field]: url };
        changed = true;
      } catch (e) {
        // Leave the inline image in place; the save still goes through.
        console.error("[image-store] upload failed", roomId, item.id, kind, e);
      }
    }
    items.push(next);
  }

  return changed ? { room: { ...room, items }, changed: true } : { room, changed: false };
}
