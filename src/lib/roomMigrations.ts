import type { Item, Room } from "./types";

// Rooms saved before Nov 2026 store piece images under `imageDataUrl` /
// `imageOriginalDataUrl`. Those fields now usually hold Storage https URLs,
// so they were renamed to `imageSrc` / `imageOriginalSrc`. Everything that
// reads a room from outside the editor (the database, a local crash draft,
// an API request from a tab opened before the rename) runs it through
// normalizeRoom first, so old data keeps working without a backfill.

type LegacyItem = Partial<Item> & {
  imageDataUrl?: string;
  imageOriginalDataUrl?: string | null;
};

export function normalizeItem(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const item = raw as LegacyItem;
  if (item.imageSrc !== undefined && item.imageDataUrl === undefined) return raw;
  const { imageDataUrl, imageOriginalDataUrl, ...rest } = item;
  return {
    ...rest,
    imageSrc: item.imageSrc ?? imageDataUrl,
    imageOriginalSrc: item.imageOriginalSrc ?? imageOriginalDataUrl ?? null,
  };
}

/** Upgrade a room of unknown age to the current shape. Leaves non-rooms alone. */
export function normalizeRoom<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const room = raw as { items?: unknown };
  if (!Array.isArray(room.items)) return raw;
  return { ...raw, items: room.items.map(normalizeItem) } as T;
}

/**
 * Add the pre-rename field names alongside the new ones in API responses,
 * so editor tabs opened before the rename keep merging image URLs after a
 * save. Safe to remove once no pre-rename tabs can still be open.
 */
export function withLegacyImageFields(room: Room): Room {
  return {
    ...room,
    items: room.items.map((it) => ({
      ...it,
      imageDataUrl: it.imageSrc,
      imageOriginalDataUrl: it.imageOriginalSrc ?? null,
    })),
  };
}
