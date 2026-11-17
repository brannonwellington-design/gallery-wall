import "server-only";
import { createHash } from "node:crypto";
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
 * is built only from validated ids plus a hash of the bytes:
 * `<roomId>/<itemId>-<kind>-<hash>.<ext>`. Hashing means a new image never
 * overwrites an older one that a piece (or its pre-background-removal
 * original, or an undo step) may still point at, and CDN-cached URLs never
 * serve stale content.
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
  const bytes = Buffer.from(parsed.base64, "base64");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const path = `${roomId}/${itemId}-${kind}-${hash}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, {
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
      ["imageSrc", "main"],
      ["imageOriginalSrc", "original"],
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

// ---- Lifecycle: copy on duplicate, clean up on delete ----

const PUBLIC_PREFIX = `/storage/v1/object/public/${IMAGE_BUCKET}/`;

/** Bucket path for one of our public image URLs, or null for anything else. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith("https://")) return null;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const u = new URL(url);
    if (u.host !== new URL(supabaseUrl).host || !u.pathname.startsWith(PUBLIC_PREFIX)) {
      return null;
    }
    return decodeURIComponent(u.pathname.slice(PUBLIC_PREFIX.length));
  } catch {
    return null;
  }
}

function referencedPaths(rooms: Room[]): Set<string> {
  const paths = new Set<string>();
  for (const room of rooms) {
    for (const item of room.items) {
      for (const url of [item.imageSrc, item.imageOriginalSrc]) {
        const p = storagePathFromUrl(url);
        if (p) paths.add(p);
      }
    }
  }
  return paths;
}

type StoredFile = { path: string; createdAt: number | null };

/** Every entry directly under `prefix` ("" for the bucket root), paginated. */
async function listEntries(prefix: string) {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const entries: { name: string; id: string | null; created_at?: string | null }[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(error.message);
    entries.push(...(data ?? []));
    if (!data || data.length < pageSize) return entries;
  }
}

async function listRoomFiles(roomId: string): Promise<StoredFile[]> {
  if (!isSafeId(roomId)) return [];
  return (await listEntries(roomId))
    .filter((f) => f.id) // folders have no id
    .map((f) => ({
      path: `${roomId}/${f.name}`,
      createdAt: f.created_at ? Date.parse(f.created_at) : null,
    }));
}

async function listRoomFolder(roomId: string): Promise<string[]> {
  return (await listRoomFiles(roomId)).map((f) => f.path);
}

async function removePaths(paths: string[]): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
}

/**
 * Delete stored images no room references, once they're older than
 * `minAgeMs`. The grace period covers pieces deleted recently: undo and
 * crash-draft recovery can still bring them back with their images.
 */
export async function sweepOrphanedImages(
  rooms: Room[],
  { minAgeMs, now = Date.now(), dryRun = false }: { minAgeMs: number; now?: number; dryRun?: boolean },
): Promise<{ scanned: number; deleted: string[] }> {
  if (!getServiceClient()) return { scanned: 0, deleted: [] };
  const keep = referencedPaths(rooms);
  const folders = (await listEntries("")).filter((e) => !e.id && isSafeId(e.name));
  let scanned = 0;
  const doomed: string[] = [];
  for (const folder of folders) {
    for (const file of await listRoomFiles(folder.name)) {
      scanned++;
      if (keep.has(file.path)) continue;
      // Unknown age → keep; only delete what is provably old.
      if (file.createdAt === null || now - file.createdAt < minAgeMs) continue;
      doomed.push(file.path);
    }
  }
  if (!dryRun) await removePaths(doomed);
  return { scanned, deleted: doomed };
}

/**
 * Delete files in a room's folder that no room references. Called after a
 * room is deleted, with every remaining room — older duplicates may still
 * point at the deleted room's files, and those are kept.
 */
export async function deleteUnreferencedRoomImages(
  roomId: string,
  remainingRooms: Room[],
): Promise<number> {
  const supabase = getServiceClient();
  if (!supabase) return 0;
  const keep = referencedPaths(remainingRooms);
  const doomed = (await listRoomFolder(roomId)).filter((p) => !keep.has(p));
  await removePaths(doomed);
  return doomed.length;
}

/**
 * Give a duplicated room its own copies of the source room's images, so
 * deleting either room later can't remove images the other still shows.
 * Images that fail to copy keep pointing at the original file.
 */
export async function copyRoomImages(toRoomId: string, room: Room): Promise<Room> {
  const supabase = getServiceClient();
  if (!supabase || !isSafeId(toRoomId)) return room;
  const copied = new Map<string, string>();
  const copyOne = async (url: string | null | undefined) => {
    const from = storagePathFromUrl(url);
    if (!from || !url) return url;
    if (from.startsWith(`${toRoomId}/`)) return url;
    const hit = copied.get(from);
    if (hit) return hit;
    const to = `${toRoomId}/${from.slice(from.lastIndexOf("/") + 1)}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).copy(from, to);
    if (error) {
      console.error("[image-store] copy failed", from, to, error.message);
      return url;
    }
    const next = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(to).data.publicUrl;
    copied.set(from, next);
    return next;
  };
  const items: Item[] = [];
  for (const item of room.items) {
    items.push({
      ...item,
      imageSrc: (await copyOne(item.imageSrc)) ?? item.imageSrc,
      imageOriginalSrc: (await copyOne(item.imageOriginalSrc)) ?? item.imageOriginalSrc,
    });
  }
  return { ...room, items };
}
