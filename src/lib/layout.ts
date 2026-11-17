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
import { outerSize } from "./geometry";
import { toMm } from "./units";

export type LayoutTemplate = "salon" | "grid" | "row";

type Wall = { width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number };
type Position = { id: string; x: number; y: number };

/** Room context the templates respect. */
export type LayoutContext = {
  /** Areas art must not overlap (fixtures, clearance above furniture), mm. */
  obstacles?: { x: number; y: number; width: number; height: number }[];
  /** Horizontal center for the arrangement (default: wall center). */
  centerX?: number;
  /** The arrangement's bottom edge must stay above this y (e.g. over a sofa). */
  maxBottom?: number;
};

type Ctx = { obstacles: Rect[]; centerX: number; maxBottom: number };

/** mm of clear space the engine tries to leave between any two pieces. */
const DEFAULT_GAP_MM = toMm(3, "in");

function itemW(it: Item): number {
  return outerSize(it).width;
}
function itemH(it: Item): number {
  return outerSize(it).height;
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
  context: LayoutContext = {},
): { items: Item[]; template: LayoutTemplate | null } {
  const ctx: Ctx = {
    obstacles: (context.obstacles ?? []).map((o) => ({ x: o.x, y: o.y, w: o.width, h: o.height })),
    centerX: context.centerX ?? wall.width / 2,
    maxBottom: Math.min(wall.height, context.maxBottom ?? wall.height),
  };
  const pinned = items.filter((i) => i.pinned);
  const movable = items.filter((i) => !i.pinned);
  if (movable.length === 0) return { items, template: null };

  const targetY = eyeLineY ?? ctx.maxBottom / 2;
  const order = shuffle<LayoutTemplate>(["salon", "grid", "row"]);

  // Progressive gap fallback. Most rooms succeed at the full gap; very
  // dense walls fall back to a tighter gap before failing.
  for (const g of [gap, gap * 0.5, gap * 0.25, 0]) {
    for (const tmpl of order) {
      const positions = computeLayout(tmpl, movable, pinned, wall, targetY, g, ctx);
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
  ctx: Ctx,
): Position[] | null {
  switch (tmpl) {
    case "row":
      return rowLayout(movable, pinned, wall, eyeLineY, gap, ctx);
    case "grid":
      return gridLayout(movable, pinned, wall, eyeLineY, gap, ctx);
    case "salon":
      return salonLayout(movable, pinned, wall, eyeLineY, gap, ctx);
  }
}

// ── Block placement ───────────────────────────────────────────────────
//
// Row and grid build the arrangement as one block (positions relative to
// the block's top-left). The block goes at its preferred spot — centered
// on ctx.centerX, around the eye line, above ctx.maxBottom — or, if a
// pinned piece or fixture is in the way, at the nearest spot that's clear.

type Placed = { id: string; dx: number; dy: number; w: number; h: number };

function placeBlock(
  placed: Placed[],
  blockW: number,
  blockH: number,
  wall: Wall,
  eyeLineY: number,
  gap: number,
  ctx: Ctx,
  pinned: Item[],
): Position[] | null {
  const maxX = wall.width - blockW;
  const maxY = ctx.maxBottom - blockH;
  if (maxX < 0 || maxY < 0) return null;
  const occupied = [...pinned.map(itemRect), ...ctx.obstacles];
  const fits = (bx: number, by: number) =>
    placed.every(
      (p) =>
        !occupied.some((o) =>
          overlaps(expand({ x: bx + p.dx, y: by + p.dy, w: p.w, h: p.h }, gap), o),
        ),
    );
  const prefX = clamp(ctx.centerX - blockW / 2, 0, maxX);
  const prefY = clamp(eyeLineY - blockH / 2, 0, maxY);
  const at = (bx: number, by: number) =>
    placed.map((p) => ({ id: p.id, x: bx + p.dx, y: by + p.dy }));
  if (fits(prefX, prefY)) return at(prefX, prefY);
  if (occupied.length === 0) return null;

  // Search a 1" lattice, nearest to the preferred spot first. Vertical
  // moves cost a little more than horizontal so the block stays near eye
  // level when it can slide sideways instead.
  const step = toMm(1, "in");
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let by = 0; by <= maxY + 0.01; by += step) {
    for (let bx = 0; bx <= maxX + 0.01; bx += step) {
      const dx = bx - prefX;
      const dy = (by - prefY) * 1.5;
      candidates.push({ x: bx, y: by, d: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const c of candidates) {
    if (fits(c.x, c.y)) return at(c.x, c.y);
  }
  return null;
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
  ctx: Ctx,
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
  if (totalH > ctx.maxBottom) return null;

  // Lay rows out inside a block, each row centered in the block.
  const blockW = Math.max(...rows.map((r) => r.width));
  const placed: Placed[] = [];
  let yCursor = 0;
  for (const row of rows) {
    let xCursor = (blockW - row.width) / 2;
    for (const it of row.items) {
      const w = itemW(it);
      const h = itemH(it);
      placed.push({ id: it.id, dx: xCursor, dy: yCursor + (row.height - h) / 2, w, h });
      xCursor += w + gap;
    }
    yCursor += row.height + gap;
  }
  return placeBlock(placed, blockW, totalH, wall, eyeLineY, gap, ctx, pinned);
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
  ctx: Ctx,
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
    if (gridH > ctx.maxBottom) continue;
    const score = Math.abs(gridW / gridH - wallAspect);
    if (!best || score < best.score) {
      best = { cols, rows, gridW, gridH, score };
    }
  }
  if (!best) return null;

  const { cols, gridW, gridH } = best;
  const order = shuffle(movable);
  const placed: Placed[] = order.map((it, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      id: it.id,
      dx: c * (maxW + gap) + (maxW - itemW(it)) / 2,
      dy: r * (maxH + gap) + (maxH - itemH(it)) / 2,
      w: itemW(it),
      h: itemH(it),
    };
  });
  return placeBlock(placed, gridW, gridH, wall, eyeLineY, gap, ctx, pinned);
}

// ── Salon: anchor + grid-search candidates ────────────────────────────
//
// Old version was pure rejection sampling at 200 attempts/piece — too
// noisy to reliably place 20+ pieces. New version generates a regular
// grid of candidate positions (step = gap) and, for each piece, walks
// them nearest-first from the cluster's center. Guarantees finding any valid placement if one exists
// on the candidate lattice. Anchor is the biggest piece, centered with
// slight horizontal jitter so successive runs vary.

function salonLayout(
  movable: Item[],
  pinned: Item[],
  wall: Wall,
  eyeLineY: number,
  gap: number,
  ctx: Ctx,
): Position[] | null {
  const sorted = [...movable].sort((a, b) => area(b) - area(a));
  const positions: Position[] = [];
  const occupied: Rect[] = [...pinned.map(itemRect), ...ctx.obstacles];

  // Anchor: biggest piece, slight horizontal jitter near center.
  const anchor = sorted[0];
  const aw = itemW(anchor);
  const ah = itemH(anchor);
  const anchorJitter = (Math.random() - 0.5) * 0.1 * wall.width;
  const anchorX = clamp(
    ctx.centerX - aw / 2 + anchorJitter,
    0,
    wall.width - aw,
  );
  const anchorY = clamp(eyeLineY - ah / 2, 0, ctx.maxBottom - ah);
  // If something's in the way, move the anchor to the nearest clear spot.
  const anchorSpot = placeBlock(
    [{ id: anchor.id, dx: 0, dy: 0, w: aw, h: ah }],
    aw,
    ah,
    wall,
    anchorY + ah / 2,
    gap,
    { ...ctx, centerX: anchorX + aw / 2, obstacles: occupied },
    [],
  );
  if (!anchorSpot) return null;
  const anchorRect: Rect = { x: anchorSpot[0].x, y: anchorSpot[0].y, w: aw, h: ah };
  positions.push({ id: anchor.id, x: anchorRect.x, y: anchorRect.y });
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

  // Salon walls read as one tight cluster, so each piece goes at the open
  // spot nearest the cluster's current center (with a little jitter so
  // runs differ) — never below the furniture line.
  const art: Rect[] = [anchorRect];
  for (const it of sorted.slice(1)) {
    const w = itemW(it);
    const h = itemH(it);
    const cx = art.reduce((sum, r) => sum + r.x + r.w / 2, 0) / art.length;
    const cy = art.reduce((sum, r) => sum + r.y + r.h / 2, 0) / art.length;
    const jitter = step * 3;
    const tried = candidates
      .map((c) => {
        const dx = c.x + w / 2 - cx + (Math.random() - 0.5) * jitter;
        const dy = c.y + h / 2 - cy + (Math.random() - 0.5) * jitter;
        return { c, d: dx * dx + dy * dy };
      })
      .sort((a, b) => a.d - b.d);
    let placed = false;
    for (const { c } of tried) {
      const rect: Rect = { x: c.x, y: c.y, w, h };
      if (!withinWall(rect, wall)) continue;
      if (rect.y + rect.h > ctx.maxBottom) continue;
      if (occupied.some((o) => overlaps(expand(rect, gap), o))) continue;
      positions.push({ id: it.id, x: c.x, y: c.y });
      occupied.push(rect);
      art.push(rect);
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  return positions;
}
