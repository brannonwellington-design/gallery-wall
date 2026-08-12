import type { Item, Room } from "./types";

const PATCH_SAFE_BYTES = 3_500_000;

export function roomPayloadBytes(room: Room): number {
  return JSON.stringify({ room }).length;
}

export function roomExceedsPatchLimit(room: Room): boolean {
  return roomPayloadBytes(room) > PATCH_SAFE_BYTES;
}

/**
 * Prefer https image URLs from `server` when `draft` still has inline
 * data URLs for the same item — recovers from oversized IndexedDB drafts
 * after images have been moved to Storage.
 */
export function preferStoredImages(draft: Room, server: Room): Room {
  const byId = new Map(server.items.map((it) => [it.id, it]));
  return {
    ...draft,
    items: draft.items.map((it) => {
      const src = byId.get(it.id);
      if (!src) return it;
      return mergeItemImages(it, src);
    }),
  };
}

function mergeItemImages(draft: Item, server: Item): Item {
  let next = draft;
  if (
    draft.imageDataUrl.startsWith("data:") &&
    server.imageDataUrl.startsWith("http")
  ) {
    next = { ...next, imageDataUrl: server.imageDataUrl };
  }
  if (
    draft.imageOriginalDataUrl?.startsWith("data:") &&
    server.imageOriginalDataUrl?.startsWith("http")
  ) {
    next = { ...next, imageOriginalDataUrl: server.imageOriginalDataUrl };
  }
  return next;
}

/**
 * Upload every remaining data: image on the room via /api/images, returning
 * a room whose images are https URLs (or unchanged on failure).
 */
export async function externalizeRoomImagesClient(
  roomId: string,
  room: Room,
): Promise<Room> {
  const items: Item[] = [];
  let changed = false;

  for (const item of room.items) {
    let next = item;

    if (item.imageDataUrl.startsWith("data:")) {
      const url = await uploadOne(roomId, item.id, "main", item.imageDataUrl);
      if (url) {
        next = { ...next, imageDataUrl: url };
        changed = true;
      }
    }

    if (next.imageOriginalDataUrl?.startsWith("data:")) {
      const url = await uploadOne(
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

  return changed ? { ...room, items } : room;
}

async function uploadOne(
  roomId: string,
  itemId: string,
  kind: "main" | "original",
  dataUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, itemId, kind, dataUrl }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[externalize] upload failed", itemId, kind, txt);
      return null;
    }
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch (e) {
    console.error("[externalize] upload error", e);
    return null;
  }
}
