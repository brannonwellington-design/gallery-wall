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
 * Build red-line spacing segments for on-wall pieces only.
 *
 * Each gap is emitted once:
 * - Item↔item: only measured looking right / down (so A→B isn't also B→A)
 * - Item↔wall: clearance on each side when the wall is the nearest obstacle
 *
 * Dimension lines between items sit on the midline of their overlap so
 * stacked/side-by-side pairs don't spawn parallel copies at each center.
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

    // --- Left wall clearance (skip if another item is nearer) ---
    {
      const neighbor = nearestLeft(a, onWall);
      if (!neighbor && a.x > OVERLAP_EPS) {
        segs.push({
          kind: "h",
          x0: 0,
          y0: aCy,
          x1: a.x,
          y1: aCy,
          distance: a.x,
          between: "wall",
        });
      }
    }

    // --- Right: item gap (once) or wall clearance ---
    {
      const neighbor = nearestRight(a, onWall);
      if (neighbor) {
        const distance = neighbor.x - aRight;
        if (distance > OVERLAP_EPS) {
          const y = overlapMid(a.y, aBottom, neighbor.y, neighbor.y + neighbor.height);
          segs.push({
            kind: "h",
            x0: aRight,
            y0: y,
            x1: neighbor.x,
            y1: y,
            distance,
            between: "items",
          });
        }
      } else {
        const distance = wall.width - aRight;
        if (distance > OVERLAP_EPS) {
          segs.push({
            kind: "h",
            x0: aRight,
            y0: aCy,
            x1: wall.width,
            y1: aCy,
            distance,
            between: "wall",
          });
        }
      }
    }

    // --- Top wall clearance ---
    {
      const neighbor = nearestAbove(a, onWall);
      if (!neighbor && a.y > OVERLAP_EPS) {
        segs.push({
          kind: "v",
          x0: aCx,
          y0: 0,
          x1: aCx,
          y1: a.y,
          distance: a.y,
          between: "wall",
        });
      }
    }

    // --- Bottom: item gap (once) or wall clearance ---
    {
      const neighbor = nearestBelow(a, onWall);
      if (neighbor) {
        const distance = neighbor.y - aBottom;
        if (distance > OVERLAP_EPS) {
          const x = overlapMid(a.x, aRight, neighbor.x, neighbor.x + neighbor.width);
          segs.push({
            kind: "v",
            x0: x,
            y0: aBottom,
            x1: x,
            y1: neighbor.y,
            distance,
            between: "items",
          });
        }
      } else {
        const distance = wall.height - aBottom;
        if (distance > OVERLAP_EPS) {
          segs.push({
            kind: "v",
            x0: aCx,
            y0: aBottom,
            x1: aCx,
            y1: wall.height,
            distance,
            between: "wall",
          });
        }
      }
    }
  }

  return segs;
}

function nearestLeft(a: NamedRect, others: NamedRect[]): NamedRect | null {
  let best: NamedRect | null = null;
  let bestRight = -Infinity;
  const aBottom = a.y + a.height;
  for (const b of others) {
    if (b.id === a.id) continue;
    if (!rangesOverlap(a.y, aBottom, b.y, b.y + b.height)) continue;
    const bRight = b.x + b.width;
    if (bRight <= a.x + OVERLAP_EPS && bRight > bestRight) {
      best = b;
      bestRight = bRight;
    }
  }
  return best;
}

function nearestRight(a: NamedRect, others: NamedRect[]): NamedRect | null {
  let best: NamedRect | null = null;
  let bestX = Infinity;
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  for (const b of others) {
    if (b.id === a.id) continue;
    if (!rangesOverlap(a.y, aBottom, b.y, b.y + b.height)) continue;
    if (b.x >= aRight - OVERLAP_EPS && b.x < bestX) {
      best = b;
      bestX = b.x;
    }
  }
  return best;
}

function nearestAbove(a: NamedRect, others: NamedRect[]): NamedRect | null {
  let best: NamedRect | null = null;
  let bestBottom = -Infinity;
  const aRight = a.x + a.width;
  for (const b of others) {
    if (b.id === a.id) continue;
    if (!rangesOverlap(a.x, aRight, b.x, b.x + b.width)) continue;
    const bBottom = b.y + b.height;
    if (bBottom <= a.y + OVERLAP_EPS && bBottom > bestBottom) {
      best = b;
      bestBottom = bBottom;
    }
  }
  return best;
}

function nearestBelow(a: NamedRect, others: NamedRect[]): NamedRect | null {
  let best: NamedRect | null = null;
  let bestY = Infinity;
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  for (const b of others) {
    if (b.id === a.id) continue;
    if (!rangesOverlap(a.x, aRight, b.x, b.x + b.width)) continue;
    if (b.y >= aBottom - OVERLAP_EPS && b.y < bestY) {
      best = b;
      bestY = b.y;
    }
  }
  return best;
}

/** Midpoint of the overlapping span on one axis. */
function overlapMid(a0: number, a1: number, b0: number, b1: number): number {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return (lo + hi) / 2;
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
