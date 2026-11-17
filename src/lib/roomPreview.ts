import { outerRect } from "./geometry";
import { normalizeRoom } from "./roomMigrations";
import type { Room, RoomPreview } from "./types";

/** Most pieces a thumbnail draws; beyond this they're too small to see. */
const MAX_PREVIEW_ITEMS = 60;

/**
 * Shrink a room to what the rooms-list thumbnail needs. Inline data: images
 * are left out (they can be megabytes) and drawn as a plain block instead.
 */
export function buildRoomPreview(raw: Room): RoomPreview {
  const room = normalizeRoom(raw);
  return {
    wallWidth: room.wallWidth,
    wallHeight: room.wallHeight,
    items: (room.items ?? []).slice(0, MAX_PREVIEW_ITEMS).map((it) => {
      const r = outerRect(it);
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        image: it.imageSrc?.startsWith("https://") ? it.imageSrc : null,
        frameColor: it.frame?.frameColor ?? null,
      };
    }),
    fixtures: (room.fixtures ?? []).map((f) => ({
      kind: f.kind,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    })),
  };
}
