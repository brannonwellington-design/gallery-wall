import type { Room } from "./types";

/** Fast identity for a data URL without hashing the full payload. */
function imageId(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return null;
  return `${dataUrl.length}:${dataUrl.slice(0, 48)}:${dataUrl.slice(-24)}`;
}

/**
 * Lightweight room signature for dirty-checking. Avoids JSON.stringify of
 * full base64 image payloads on every edit (which can be multi-MB and was
 * freezing / crashing the tab).
 */
export function roomFingerprint(room: Room): string {
  return JSON.stringify({
    name: room.name,
    wallWidth: room.wallWidth,
    wallHeight: room.wallHeight,
    unit: room.unit,
    eyeLineHeight: room.eyeLineHeight ?? null,
    eyeLineEnabled: room.eyeLineEnabled ?? null,
    items: room.items.map((it) => ({
      id: it.id,
      name: it.name,
      artWidth: it.artWidth,
      artHeight: it.artHeight,
      artWidthOriginal: it.artWidthOriginal ?? null,
      artHeightOriginal: it.artHeightOriginal ?? null,
      frame: it.frame,
      x: it.x,
      y: it.y,
      pinned: it.pinned ?? false,
      img: imageId(it.imageDataUrl),
      imgOrig: imageId(it.imageOriginalDataUrl),
    })),
  });
}
