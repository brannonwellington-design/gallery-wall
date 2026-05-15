// Gallery-wall layout engine. Pure logic, no React.
//
// Picks a classic gallery-wall pattern (grid / multi-row / salon) and
// produces new x/y coordinates for the unpinned pieces. Pinned pieces
// stay where they are and become fixed obstacles the engine must route
// around.
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
 * Randomize positions of all unpinned items.
 *
 * Tries each template in a shuffled order. If none fits at the requested
 * gap, falls back to progressively smaller gaps before giving up. When
 * the function truly can't place everything, items are returned unchanged
 * with template=null so the caller can surface a "didn't fit" message.
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

  const targetY = eyeLineY ?? wall.height / 2;
  const order = shuffle<LayoutTemplate>(["salon", "grid", "row"]);

  // Progressive gap fallback. Most rooms succeed at the full gap; very
  // dense walls fall back to a tighter gap before failing.
  for (const g of [gap, gap * 0.5, gap * 0.25, 0]) {
    for (const tmpl of order) {
      const positions = computeLayout(tmpl, movable, pinned, wall, targetY, g);
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
  }

  console.warn(
    "[randomize] No template fit — try fewer pieces, a bigger wall, or unpinning pieces.",
  );
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

// ── Row: greedy multi-row packing ─────────────────────────────────────
//
// Packs pieces left-to-right; when the next piece would overflow the
// wall width, wrap to a new row. Each row centers horizontally; the
// whole stack centers vertically around the eye line. Falls back to
// failure only if the stacked rows can't fit the wall height.

function rowLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  const order = shuffle(movable);

  // Build rows greedily.
  type Row = { items: Item[]; width: number; height: number };
  const rows: Row[] = [];
  let current: Row = { items: [], width: 0, height: 0 };
  for (const it of order) {
    const w = itemW(it);
    const h = itemH(it);
    const sep = current.items.length > 0 ? gap : 0;
    if (current.width + sep + w > wall.width && current.items.length > 0) {
      rows.push(current);
      current = { items: [it], width: w, height: h };
    } else {
      current.items.push(it);
      current.width += sep + w;
      current.height = Math.max(current.height, h);
    }
  }
  if (current.items.length > 0) rows.push(current);

  const totalH =
    rows.reduce((s, r) => s + r.height, 0) + (rows.length - 1) * gap;
  if (totalH > wall.height) return null;

  let yCursor = clamp(eyeLineY - totalH / 2, 0, wall.height - totalH);
  const positions: Position[] = [];
  const occupied = pinned.map(itemRect);
  for (const row of rows) {
    let xCursor = (wall.width - row.width) / 2;
    for (const it of row.items) {
      const w = itemW(it);
      const h = itemH(it);
      const y = yCursor + (row.height - h) / 2; // vertical-center within row
      const rect: Rect = { x: xCursor, y, w, h };
      if (occupied.some((o) => overlaps(expand(rect, gap), o))) return null;
      positions.push({ id: it.id, x: xCursor, y });
      occupied.push(rect);
      xCursor += w + gap;
    }
    yCursor += row.height + gap;
  }
  return positions;
}

// ── Grid: search for a valid (cols, rows) shape ───────────────────────
//
// Old version guessed cols = round(√count), which often produced a
// grid taller than the wall when there was one big piece. New version
// iterates over every cols ∈ [1, maxColsThatFit] and picks the shape
// whose aspect ratio is closest to the wall's. Cells size to the
// largest piece (uniform grid is the brand-appropriate look); each
// piece is centered inside its cell.

function gridLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  const count = movable.length;
  const maxW = Math.max(...movable.map(itemW));
  const maxH = Math.max(...movable.map(itemH));
  const maxCols = Math.max(
    1,
    Math.floor((wall.width + gap) / (maxW + gap)),
  );

  const wallAspect = wall.width / wall.height;
  type Shape = {
    cols: number;
    rows: number;
    gridW: number;
    gridH: number;
    score: number;
  };
  let best: Shape | null = null;
  for (let cols = 1; cols <= Math.min(maxCols, count); cols++) {
    const rows = Math.ceil(count / cols);
    const gridW = cols * maxW + (cols - 1) * gap;
    const gridH = rows * maxH + (rows - 1) * gap;
    if (gridH > wall.height) continue;
    const score = Math.abs(gridW / gridH - wallAspect);
    if (!best || score < best.score) {
      best = { cols, rows, gridW, gridH, score };
    }
  }
  if (!best) return null;

  const { cols, gridW, gridH } = best;
  const startX = (wall.width - gridW) / 2;
  const startY = clamp(eyeLineY - gridH / 2, 0, wall.height - gridH);

  const order = shuffle(movable);
  const positions: Position[] = [];
  const occupied = pinned.map(itemRect);
  for (let i = 0; i < order.length; i++) {
    const it = order[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cellX = startX + c * (maxW + gap);
    const cellY = startY + r * (maxH + gap);
    const x = cellX + (maxW - itemW(it)) / 2;
    const y = cellY + (maxH - itemH(it)) / 2;
    const rect: Rect = { x, y, w: itemW(it), h: itemH(it) };
    if (occupied.some((o) => overlaps(expand(rect, gap), o))) return null;
    positions.push({ id: it.id, x, y });
    occupied.push(rect);
  }
  return positions;
}

// ── Salon: anchor + grid-search candidates ────────────────────────────
//
// Old version was pure rejection sampling at 200 attempts/piece — too
// noisy to reliably place 20+ pieces. New version generates a regular
// grid of candidate positions (step = gap), shuffles, and walks them
// for each piece. Guarantees finding any valid placement if one exists
// on the candidate lattice. Anchor is the biggest piece, centered with
// slight horizontal jitter so successive runs vary.

function salonLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
): Position[] | null {
  const sorted = [...movable].sort((a, b) => area(b) - area(a));
  const positions: Position[] = [];
  const occupied: Rect[] = pinned.map(itemRect);

  // Anchor: biggest piece, slight horizontal jitter near center.
  const anchor = sorted[0];
  const aw = itemW(anchor);
  const ah = itemH(anchor);
  const anchorJitter = (Math.random() - 0.5) * 0.1 * wall.width;
  const anchorX = clamp(
    wall.width / 2 - aw / 2 + anchorJitter,
    0,
    wall.width - aw,
  );
  const anchorY = clamp(eyeLineY - ah / 2, 0, wall.height - ah);
  const anchorRect: Rect = { x: anchorX, y: anchorY, w: aw, h: ah };
  if (pinned.some((p) => overlaps(expand(anchorRect, gap), itemRect(p)))) {
    return null;
  }
  positions.push({ id: anchor.id, x: anchorX, y: anchorY });
  occupied.push(anchorRect);

  // Candidate lattice. Step = max(20mm, gap) — fine enough to find tight
  // packings, coarse enough to stay cheap.
  const step = Math.max(toMm(0.5, "in"), gap);
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y <= wall.height; y += step) {
    for (let x = 0; x <= wall.width; x += step) {
      candidates.push({ x, y });
    }
  }

  for (const it of sorted.slice(1)) {
    const w = itemW(it);
    const h = itemH(it);
    const tried = shuffle(candidates);
    let placed = false;
    for (const c of tried) {
      const rect: Rect = { x: c.x, y: c.y, w, h };
      if (!withinWall(rect, wall)) continue;
      if (occupied.some((o) => overlaps(expand(rect, gap), o))) continue;
      positions.push({ id: it.id, x: c.x, y: c.y });
      occupied.push(rect);
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  return positions;
}
