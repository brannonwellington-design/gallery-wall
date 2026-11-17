// Turns a room into hanging instructions: pieces numbered in the order you'd
// hang them (left to right, then top to bottom), with nail positions measured
// the way you'd use a tape — from the wall's left edge and up from the floor.
// Pure logic; the guide page renders it.

import { hangerOf, nailPoints, outerRect, type NailPoint, type Rect } from "./geometry";
import type { Hanger, Item, Room } from "./types";

export type GuideRow = {
  number: number;
  item: Item;
  rect: Rect;
  hanger: Hanger & { assumed: boolean };
  nails: NailPoint[];
  /** mm from the floor to the top edge of the piece. */
  topFromFloor: number;
  /** mm from the floor to the piece's center (the "57 inch" number). */
  centerFromFloor: number;
  warnings: string[];
};

const EPS = 0.5; // mm

export function buildHangingGuide(room: Room): GuideRow[] {
  const rows = room.items.map((item) => {
    const rect = outerRect(item);
    const nails = nailPoints(item, room.wallHeight);
    return { item, rect, nails, sortX: nails[0]?.fromLeft ?? rect.x, sortY: rect.y };
  });

  // Left to right; pieces in the same column (within 2") top to bottom.
  rows.sort((a, b) => {
    const dx = a.sortX - b.sortX;
    return Math.abs(dx) > 50 ? dx : a.sortY - b.sortY;
  });

  return rows.map(({ item, rect, nails }, i) => {
    const warnings: string[] = [];
    if (
      rect.x < -EPS ||
      rect.y < -EPS ||
      rect.x + rect.width > room.wallWidth + EPS ||
      rect.y + rect.height > room.wallHeight + EPS
    ) {
      warnings.push("Hangs past the edge of the wall");
    }
    const overlapsOther = room.items.some(
      (other) => other.id !== item.id && overlaps(rect, outerRect(other)),
    );
    if (overlapsOther) warnings.push("Overlaps another piece");
    const hanger = hangerOf(item);
    if (hanger.assumed) warnings.push("Hanger not measured — nail height assumes 2″ wire drop");
    return {
      number: i + 1,
      item,
      rect,
      hanger,
      nails,
      topFromFloor: room.wallHeight - rect.y,
      centerFromFloor: room.wallHeight - (rect.y + rect.height / 2),
      warnings,
    };
  });
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    b.x < a.x + a.width - EPS &&
    a.y < b.y + b.height - EPS &&
    b.y < a.y + a.height - EPS
  );
}
