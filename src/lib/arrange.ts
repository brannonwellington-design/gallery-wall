// Arranging several pieces at once: align, distribute, center, duplicate.
// Pure functions over mm positions, using each piece's outer (framed) box.

import { outerRect } from "./geometry";
import type { Item } from "./types";
import { toMm } from "./units";

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

function patch(items: Item[], moves: Map<string, { x?: number; y?: number }>): Item[] {
  return items.map((it) => {
    const m = moves.get(it.id);
    return m ? { ...it, x: m.x ?? it.x, y: m.y ?? it.y } : it;
  });
}

/** Line the selected pieces up on one edge or center line of their bounding box. */
export function alignItems(items: Item[], ids: Set<string>, mode: AlignMode): Item[] {
  const sel = items.filter((it) => ids.has(it.id));
  if (sel.length < 2) return items;
  const rects = sel.map((it) => ({ it, r: outerRect(it) }));
  const left = Math.min(...rects.map(({ r }) => r.x));
  const right = Math.max(...rects.map(({ r }) => r.x + r.width));
  const top = Math.min(...rects.map(({ r }) => r.y));
  const bottom = Math.max(...rects.map(({ r }) => r.y + r.height));
  const moves = new Map<string, { x?: number; y?: number }>();
  for (const { it, r } of rects) {
    switch (mode) {
      case "left":
        moves.set(it.id, { x: left });
        break;
      case "right":
        moves.set(it.id, { x: right - r.width });
        break;
      case "hcenter":
        moves.set(it.id, { x: (left + right) / 2 - r.width / 2 });
        break;
      case "top":
        moves.set(it.id, { y: top });
        break;
      case "bottom":
        moves.set(it.id, { y: bottom - r.height });
        break;
      case "vcenter":
        moves.set(it.id, { y: (top + bottom) / 2 - r.height / 2 });
        break;
    }
  }
  return patch(items, moves);
}

/**
 * Space the selected pieces so the gaps between neighbours are equal, keeping
 * the outermost two where they are. With `gap`, use that exact spacing
 * instead, measured from the first piece.
 */
export function distributeItems(
  items: Item[],
  ids: Set<string>,
  axis: "x" | "y",
  gap?: number,
): Item[] {
  const sel = items
    .filter((it) => ids.has(it.id))
    .map((it) => ({ it, r: outerRect(it) }))
    .sort((a, b) => (axis === "x" ? a.r.x - b.r.x : a.r.y - b.r.y));
  if (sel.length < (gap === undefined ? 3 : 2)) return items;
  const size = (r: { width: number; height: number }) => (axis === "x" ? r.width : r.height);
  const start = (r: { x: number; y: number }) => (axis === "x" ? r.x : r.y);
  const first = sel[0].r;
  const last = sel[sel.length - 1].r;
  const total = sel.reduce((s, { r }) => s + size(r), 0);
  const spacing =
    gap ?? (start(last) + size(last) - start(first) - total) / (sel.length - 1);
  const moves = new Map<string, { x?: number; y?: number }>();
  let cursor = start(first);
  for (const { it, r } of sel) {
    moves.set(it.id, axis === "x" ? { x: cursor } : { y: cursor });
    cursor += size(r) + spacing;
  }
  return patch(items, moves);
}

/** Move the selection as a block so its center sits on `centerX`. */
export function centerItemsAt(items: Item[], ids: Set<string>, centerX: number): Item[] {
  const sel = items.filter((it) => ids.has(it.id)).map(outerRect);
  if (sel.length === 0) return items;
  const left = Math.min(...sel.map((r) => r.x));
  const right = Math.max(...sel.map((r) => r.x + r.width));
  const dx = centerX - (left + right) / 2;
  return items.map((it) => (ids.has(it.id) ? { ...it, x: it.x + dx } : it));
}

/** Shift the selection by a delta in mm. */
export function moveItems(items: Item[], ids: Set<string>, dx: number, dy: number): Item[] {
  return items.map((it) => (ids.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it));
}

/** Offset applied to duplicates so they don't land exactly on the original. */
export const DUPLICATE_OFFSET_MM = toMm(2, "in");

/**
 * Copies of the selected pieces, nudged down-right, unpinned, with fresh
 * ids. Images are shared (same URL), which the storage cleanup accounts for.
 */
export function duplicateItems(items: Item[], ids: Set<string>, newId: () => string): Item[] {
  return items
    .filter((it) => ids.has(it.id))
    .map((it) => ({
      ...it,
      id: newId(),
      name: it.name,
      x: it.x + DUPLICATE_OFFSET_MM,
      y: it.y + DUPLICATE_OFFSET_MM,
      pinned: false,
    }));
}
