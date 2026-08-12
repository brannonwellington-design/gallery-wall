import type { Rect as SnapRect } from "./snap";

export type SpacingSegment = {
  /** Horizontal gap (left↔right) or vertical gap (top↔bottom). */
  kind: "h" | "v";
  /** Segment endpoints in wall mm. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Gap length in mm. */
  distance: number;
  /** What the gap is measuring. */
  between: "items" | "wall";
};

type NamedRect = SnapRect & { id: string };

const OVERLAP_EPS = 0.5; // mm — treat as overlapping on the cross-axis

/**
 * Build red-line spacing segments: nearest gaps between items, and each
 * item's clearance to the wall edges (only when the wall is the nearest
 * obstacle in that direction).
 *
 * Items that sit outside the wall bounds are ignored entirely.
 */
export function computeSpacingSegments(
  items: NamedRect[],
  wall: { width: number; height: number },
): SpacingSegment[] {
  const segs: SpacingSegment[] = [];
  const onWall = items.filter((it) => isFullyOnWall(it, wall));
  if (onWall.length === 0) return segs;

  for (const a of onWall) {
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    const aCy = a.y + a.height / 2;
    const aCx = a.x + a.width / 2;

    // --- Left (toward x=0) ---
    {
      let best: { x: number; id: string | null } = { x: 0, id: null };
      for (const b of onWall) {
        if (b.id === a.id) continue;
        if (!rangesOverlap(a.y, aBottom, b.y, b.y + b.height)) continue;
        const bRight = b.x + b.width;
        if (bRight <= a.x + OVERLAP_EPS && bRight > best.x) {
          best = { x: bRight, id: b.id };
        }
      }
      const distance = a.x - best.x;
      if (distance > OVERLAP_EPS) {
        segs.push({
          kind: "h",
          x0: best.x,
          y0: aCy,
          x1: a.x,
          y1: aCy,
          distance,
          between: best.id ? "items" : "wall",
        });
      }
    }

    // --- Right (toward wall.width) ---
    {
      let best: { x: number; id: string | null } = {
        x: wall.width,
        id: null,
      };
      for (const b of onWall) {
        if (b.id === a.id) continue;
        if (!rangesOverlap(a.y, aBottom, b.y, b.y + b.height)) continue;
        if (b.x >= aRight - OVERLAP_EPS && b.x < best.x) {
          best = { x: b.x, id: b.id };
        }
      }
      const distance = best.x - aRight;
      if (distance > OVERLAP_EPS) {
        segs.push({
          kind: "h",
          x0: aRight,
          y0: aCy,
          x1: best.x,
          y1: aCy,
          distance,
          between: best.id ? "items" : "wall",
        });
      }
    }

    // --- Top (toward y=0) ---
    {
      let best: { y: number; id: string | null } = { y: 0, id: null };
      for (const b of onWall) {
        if (b.id === a.id) continue;
        if (!rangesOverlap(a.x, aRight, b.x, b.x + b.width)) continue;
        const bBottom = b.y + b.height;
        if (bBottom <= a.y + OVERLAP_EPS && bBottom > best.y) {
          best = { y: bBottom, id: b.id };
        }
      }
      const distance = a.y - best.y;
      if (distance > OVERLAP_EPS) {
        segs.push({
          kind: "v",
          x0: aCx,
          y0: best.y,
          x1: aCx,
          y1: a.y,
          distance,
          between: best.id ? "items" : "wall",
        });
      }
    }

    // --- Bottom (toward wall.height) ---
    {
      let best: { y: number; id: string | null } = {
        y: wall.height,
        id: null,
      };
      for (const b of onWall) {
        if (b.id === a.id) continue;
        if (!rangesOverlap(a.x, aRight, b.x, b.x + b.width)) continue;
        if (b.y >= aBottom - OVERLAP_EPS && b.y < best.y) {
          best = { y: b.y, id: b.id };
        }
      }
      const distance = best.y - aBottom;
      if (distance > OVERLAP_EPS) {
        segs.push({
          kind: "v",
          x0: aCx,
          y0: aBottom,
          x1: aCx,
          y1: best.y,
          distance,
          between: best.id ? "items" : "wall",
        });
      }
    }
  }

  return dedupeSegments(segs);
}

/** True when the piece's full bounding box sits inside the wall. */
function isFullyOnWall(
  rect: NamedRect,
  wall: { width: number; height: number },
): boolean {
  return (
    rect.x >= -OVERLAP_EPS &&
    rect.y >= -OVERLAP_EPS &&
    rect.x + rect.width <= wall.width + OVERLAP_EPS &&
    rect.y + rect.height <= wall.height + OVERLAP_EPS
  );
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - OVERLAP_EPS && b0 < a1 - OVERLAP_EPS;
}

/** Item-to-item gaps are found twice (once from each side) — keep one. */
function dedupeSegments(segs: SpacingSegment[]): SpacingSegment[] {
  const seen = new Set<string>();
  const out: SpacingSegment[] = [];
  for (const s of segs) {
    const key =
      s.between === "wall"
        ? `${s.kind}:${round(s.x0)}:${round(s.y0)}:${round(s.x1)}:${round(s.y1)}`
        : s.kind === "h"
          ? `h:${round(Math.min(s.x0, s.x1))}:${round(Math.max(s.x0, s.x1))}:${round(s.y0)}`
          : `v:${round(Math.min(s.y0, s.y1))}:${round(Math.max(s.y0, s.y1))}:${round(s.x0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
