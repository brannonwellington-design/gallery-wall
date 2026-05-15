// Gallery-wall layout engine. Pure logic, no React.
//
// Picks a classic gallery-wall pattern (grid / horizontal row / salon)
// and produces new x/y coordinates for the unpinned pieces. Pinned
// pieces stay where they are and become fixed obstacles the engine
// must route around.
//
// All values in mm. Wall origin is top-left; y grows down (matches the
// canvas + snap-engine convention).

import type { Item } from "./types";
import { toMm } from "./units";

export type LayoutTemplate = "salon" | "grid" | "row";

type Wall = { width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number };
type Position = { id: string; x: number; y: number };

/** mm of clear space the engine tries to leave between any two pieces. */
const DEFAULT_GAP_MM = toMm(3, "in");

function itemW(it: Item): number {
  const pad = (it.frame?.frameWidth ?? 0) + (it.frame?.matWidth ?? 0);
  return it.artWidth + pad * 2;
}
function itemH(it: Item): number {
  const pad = (it.frame?.frameWidth ?? 0) + (it.frame?.matWidth ?? 0);
  return it.artHeight + pad * 2;
}
function itemRect(it: Item): Rect {
  return { x: it.x, y: it.y, w: itemW(it), h: itemH(it) };
}
function area(it: Item): number {
  return itemW(it) * itemH(it);
}
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function expand(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}
function withinWall(r: Rect, wall: Wall): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= wall.width && r.y + r.h <= wall.height;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Randomize the positions of all unpinned items.
 *
 * Tries each template (shuffled order). The first template that produces
 * a valid, non-overlapping layout wins. If none fit, the items array is
 * returned unchanged so the auto-save doesn't clobber the wall with
 * garbage.
 *
 * Returns the template used so the caller can surface it (e.g. as a
 * toast or status line), and the new items array.
 */
export function randomizeLayout(
  items: Item[],
  wall: Wall,
  eyeLineY: number | null,
  gap: number = DEFAULT_GAP_MM,
): { items: Item[]; template: LayoutTemplate | null } {
  const pinned = items.filter((i) => i.pinned);
  const movable = items.filter((i) => !i.pinned);
  if (movable.length === 0) return { items, template: null };

  // Fall back to mid-wall when the eye line is disabled.
  const targetY = eyeLineY ?? wall.height / 2;

  const order = shuffle<LayoutTemplate>(["salon", "grid", "row"]);
  for (const tmpl of order) {
    const positions = computeLayout(tmpl, movable, pinned, wall, targetY, gap);
    if (positions) {
      const byId = new Map(positions.map((p) => [p.id, p]));
      return {
        items: items.map((it) =>
          it.pinned ? it : { ...it, ...(byId.get(it.id) ?? {}) },
        ),
        template: tmpl,
      };
    }
  }
  return { items, template: null };
}

function computeLayout(
  tmpl: LayoutTemplate,
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  switch (tmpl) {
    case "row":
      return rowLayout(movable, pinned, wall, eyeLineY, gap);
    case "grid":
      return gridLayout(movable, pinned, wall, eyeLineY, gap);
    case "salon":
      return salonLayout(movable, pinned, wall, eyeLineY, gap);
  }
}

// ── Row ────────────────────────────────────────────────────────────────
//
// All centers on the eye line, evenly spaced left → right.

function rowLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  const order = shuffle(movable);
  const totalW = order.reduce((s, it) => s + itemW(it), 0) + gap * (order.length - 1);
  if (totalW > wall.width * 0.95) return null;

  const startX = (wall.width - totalW) / 2;
  const positions: Position[] = [];
  const occupied = pinned.map(itemRect);
  let cursor = startX;
  for (const it of order) {
    const w = itemW(it);
    const h = itemH(it);
    const y = clamp(eyeLineY - h / 2, 0, wall.height - h);
    const rect: Rect = { x: cursor, y, w, h };
    if (!withinWall(rect, wall)) return null;
    if (occupied.some((o) => overlaps(expand(rect, gap), o))) return null;
    positions.push({ id: it.id, x: rect.x, y: rect.y });
    occupied.push(rect);
    cursor += w + gap;
  }
  return positions;
}

// ── Grid ───────────────────────────────────────────────────────────────
//
// Roughly-square N×M grid, centered horizontally and vertically around
// the eye line. Each cell is sized to fit the widest/tallest piece, so
// the grid stays uniform regardless of mixed sizes.

function gridLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  const order = shuffle(movable);
  const count = order.length;
  const cols = Math.max(1, Math.round(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);

  const maxW = Math.max(...order.map(itemW));
  const maxH = Math.max(...order.map(itemH));
  const gridW = cols * maxW + (cols - 1) * gap;
  const gridH = rows * maxH + (rows - 1) * gap;
  if (gridW > wall.width * 0.95 || gridH > wall.height * 0.95) return null;

  const startX = (wall.width - gridW) / 2;
  const startY = clamp(eyeLineY - gridH / 2, 0, wall.height - gridH);

  const positions: Position[] = [];
  const occupied = pinned.map(itemRect);
  for (let i = 0; i < order.length; i++) {
    const it = order[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cellX = startX + col * (maxW + gap);
    const cellY = startY + row * (maxH + gap);
    // Center the piece inside its cell so mixed sizes still align.
    const x = cellX + (maxW - itemW(it)) / 2;
    const y = cellY + (maxH - itemH(it)) / 2;
    const rect: Rect = { x, y, w: itemW(it), h: itemH(it) };
    if (occupied.some((o) => overlaps(expand(rect, gap), o))) return null;
    positions.push({ id: it.id, x, y });
    occupied.push(rect);
  }
  return positions;
}

// ── Salon ──────────────────────────────────────────────────────────────
//
// Biggest piece anchored near the eye line, slightly off-center. Remaining
// pieces drop into nearby random positions, rejection-sampling until no
// overlaps and everything stays within a vertical "sweet zone" around the
// eye line.

function salonLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  // Largest first — anchors lay down their footprint before the rest
  // fight for the leftover space.
  const sorted = [...movable].sort((a, b) => area(b) - area(a));
  const positions: Position[] = [];
  const occupied: Rect[] = pinned.map(itemRect);

  // Pick a sweet zone that's tall enough to hold the cluster but stays
  // centered on the eye line. Bigger collections need more height.
  const sweetZoneHalf = Math.min(
    wall.height / 2,
    Math.max(
      sorted[0] ? itemH(sorted[0]) * 1.2 : 0,
      itemH(sorted[Math.floor(sorted.length / 2)] ?? sorted[0]) * sorted.length * 0.4,
    ),
  );
  const zoneTop = clamp(eyeLineY - sweetZoneHalf, 0, wall.height);
  const zoneBottom = clamp(eyeLineY + sweetZoneHalf, 0, wall.height);

  // Anchor the largest piece. Slight horizontal jitter keeps successive
  // randomizations from snapping to the exact same composition.
  const anchor = sorted[0];
  const aw = itemW(anchor);
  const ah = itemH(anchor);
  const anchorJitter = (Math.random() - 0.5) * 0.2 * wall.width;
  const anchorX = clamp(
    wall.width / 2 - aw / 2 + anchorJitter,
    0,
    wall.width - aw,
  );
  const anchorY = clamp(eyeLineY - ah / 2, 0, wall.height - ah);
  const anchorRect: Rect = { x: anchorX, y: anchorY, w: aw, h: ah };
  // If the anchor collides with a pinned piece, abort — caller will try
  // another template.
  if (pinned.some((p) => overlaps(expand(anchorRect, gap), itemRect(p)))) {
    return null;
  }
  positions.push({ id: anchor.id, x: anchorX, y: anchorY });
  occupied.push(anchorRect);

  // Rejection-sample positions for the rest.
  for (const it of sorted.slice(1)) {
    const w = itemW(it);
    const h = itemH(it);
    let placed = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.random() * (wall.width - w);
      const y = zoneTop + Math.random() * Math.max(0, zoneBottom - zoneTop - h);
      const rect: Rect = { x, y, w, h };
      if (!withinWall(rect, wall)) continue;
      if (occupied.some((o) => overlaps(expand(rect, gap), o))) continue;
      positions.push({ id: it.id, x, y });
      occupied.push(rect);
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  return positions;
}
