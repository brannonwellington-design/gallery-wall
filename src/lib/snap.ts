// Snap engine for the wall canvas. Pure logic, no React.
//
// Coordinate convention: all values are in millimetres. The wall has its
// origin at the top-left, x grows right, y grows down. Items are
// axis-aligned rectangles whose (x, y) is the top-left of the bounding
// box (frame + mat + art).

export type Rect = { x: number; y: number; width: number; height: number };

export type SnapInput = {
  /** The item being dragged. */
  dragged: Rect;
  /** Other items already on the wall. */
  others: Rect[];
  /** Wall dimensions in mm. */
  wall: { width: number; height: number };
  /** Snap threshold in mm. */
  threshold: number;
  /** When false, returns the input position with no guides. */
  enabled: boolean;
};

export type Guide =
  // A vertical guide line at x=`at`, spanning from y0 to y1.
  | { kind: "v"; at: number; y0: number; y1: number; reason: GuideReason }
  // A horizontal guide line at y=`at`, spanning from x0 to x1.
  | { kind: "h"; at: number; x0: number; x1: number; reason: GuideReason };

export type GuideReason =
  | "wall-edge"
  | "wall-center"
  | "item-edge"
  | "item-center"
  | "equal-spacing";

export type SnapResult = {
  x: number;
  y: number;
  guides: Guide[];
};

type Candidate = {
  // The position the dragged item's left/top should land at to satisfy this
  // candidate.
  pos: number;
  // Where the guide line should be drawn (in absolute wall coords).
  guideAt: number;
  reason: GuideReason;
  // Range used for drawing the guide along the perpendicular axis.
  span: [number, number];
};

export function computeSnap(input: SnapInput): SnapResult {
  const { dragged, others, wall, threshold, enabled } = input;

  if (!enabled) {
    return { x: dragged.x, y: dragged.y, guides: [] };
  }

  // Anchor offsets along each axis: where on the dragged item the snap
  // could happen (left/center/right for X; top/center/bottom for Y).
  const anchorsX = [
    { offset: 0, label: "left" as const },
    { offset: dragged.width / 2, label: "center" as const },
    { offset: dragged.width, label: "right" as const },
  ];
  const anchorsY = [
    { offset: 0, label: "top" as const },
    { offset: dragged.height / 2, label: "middle" as const },
    { offset: dragged.height, label: "bottom" as const },
  ];

  const candidatesX: Candidate[] = [];
  const candidatesY: Candidate[] = [];

  // --- Wall snaps ---
  const wallXs: { at: number; reason: GuideReason }[] = [
    { at: 0, reason: "wall-edge" },
    { at: wall.width / 2, reason: "wall-center" },
    { at: wall.width, reason: "wall-edge" },
  ];
  const wallYs: { at: number; reason: GuideReason }[] = [
    { at: 0, reason: "wall-edge" },
    { at: wall.height / 2, reason: "wall-center" },
    { at: wall.height, reason: "wall-edge" },
  ];
  for (const tgt of wallXs) {
    for (const a of anchorsX) {
      candidatesX.push({
        pos: tgt.at - a.offset,
        guideAt: tgt.at,
        reason: tgt.reason,
        span: [0, wall.height],
      });
    }
  }
  for (const tgt of wallYs) {
    for (const a of anchorsY) {
      candidatesY.push({
        pos: tgt.at - a.offset,
        guideAt: tgt.at,
        reason: tgt.reason,
        span: [0, wall.width],
      });
    }
  }

  // --- Item-to-item snaps ---
  for (const other of others) {
    const others_xs: { at: number; reason: GuideReason }[] = [
      { at: other.x, reason: "item-edge" },
      { at: other.x + other.width / 2, reason: "item-center" },
      { at: other.x + other.width, reason: "item-edge" },
    ];
    const others_ys: { at: number; reason: GuideReason }[] = [
      { at: other.y, reason: "item-edge" },
      { at: other.y + other.height / 2, reason: "item-center" },
      { at: other.y + other.height, reason: "item-edge" },
    ];
    for (const tgt of others_xs) {
      for (const a of anchorsX) {
        candidatesX.push({
          pos: tgt.at - a.offset,
          guideAt: tgt.at,
          reason: tgt.reason,
          span: spanY(other, dragged),
        });
      }
    }
    for (const tgt of others_ys) {
      for (const a of anchorsY) {
        candidatesY.push({
          pos: tgt.at - a.offset,
          guideAt: tgt.at,
          reason: tgt.reason,
          span: spanX(other, dragged),
        });
      }
    }
  }

  // --- Equal-spacing snaps (horizontal: dragged sits between two others) ---
  // For each pair (A, B) of others where A is left of B and they're roughly
  // overlapping vertically with the dragged item, compute the position that
  // makes the gap dragged.left - A.right equal to B.left - dragged.right.
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue;
      const A = others[i];
      const B = others[j];
      if (A.x + A.width >= B.x) continue; // A must be strictly left of B
      if (!yOverlap(A, dragged) || !yOverlap(B, dragged)) continue;
      const totalGap = B.x - (A.x + A.width);
      const gap = (totalGap - dragged.width) / 2;
      if (gap <= 0) continue;
      const targetX = A.x + A.width + gap;
      candidatesX.push({
        pos: targetX,
        guideAt: targetX, // not used as a single line for equal-spacing
        reason: "equal-spacing",
        span: spanY(A, B, dragged),
      });
    }
  }
  // Vertical equal-spacing
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue;
      const A = others[i];
      const B = others[j];
      if (A.y + A.height >= B.y) continue;
      if (!xOverlap(A, dragged) || !xOverlap(B, dragged)) continue;
      const totalGap = B.y - (A.y + A.height);
      const gap = (totalGap - dragged.height) / 2;
      if (gap <= 0) continue;
      const targetY = A.y + A.height + gap;
      candidatesY.push({
        pos: targetY,
        guideAt: targetY,
        reason: "equal-spacing",
        span: spanX(A, B, dragged),
      });
    }
  }

  // --- Pick the nearest candidate per axis (within threshold) ---
  const bestX = pickBest(candidatesX, dragged.x, threshold);
  const bestY = pickBest(candidatesY, dragged.y, threshold);

  const x = bestX ? bestX.pos : dragged.x;
  const y = bestY ? bestY.pos : dragged.y;

  // Collect guides for all candidates that match the chosen position
  // (so multiple aligned items all show their guide lines).
  const guides: Guide[] = [];
  if (bestX) {
    const matched = candidatesX.filter(
      (c) => Math.abs(c.pos - bestX.pos) < 0.01 && c.reason !== "equal-spacing",
    );
    for (const c of matched) {
      guides.push({
        kind: "v",
        at: c.guideAt,
        y0: Math.min(c.span[0], y),
        y1: Math.max(c.span[1], y + dragged.height),
        reason: c.reason,
      });
    }
    if (bestX.reason === "equal-spacing") {
      // Show a horizontal dashed line at item middle spanning the gap
      const midY = y + dragged.height / 2;
      guides.push({
        kind: "h",
        at: midY,
        x0: bestX.span[0],
        x1: bestX.span[1],
        reason: "equal-spacing",
      });
    }
  }
  if (bestY) {
    const matched = candidatesY.filter(
      (c) => Math.abs(c.pos - bestY.pos) < 0.01 && c.reason !== "equal-spacing",
    );
    for (const c of matched) {
      guides.push({
        kind: "h",
        at: c.guideAt,
        x0: Math.min(c.span[0], x),
        x1: Math.max(c.span[1], x + dragged.width),
        reason: c.reason,
      });
    }
    if (bestY.reason === "equal-spacing") {
      const midX = x + dragged.width / 2;
      guides.push({
        kind: "v",
        at: midX,
        y0: bestY.span[0],
        y1: bestY.span[1],
        reason: "equal-spacing",
      });
    }
  }

  return { x, y, guides };
}

function pickBest(
  candidates: Candidate[],
  current: number,
  threshold: number,
): Candidate | null {
  let best: Candidate | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c.pos - current);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function xOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

function yOverlap(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function spanX(...rects: Rect[]): [number, number] {
  const xs = rects.flatMap((r) => [r.x, r.x + r.width]);
  return [Math.min(...xs), Math.max(...xs)];
}

function spanY(...rects: Rect[]): [number, number] {
  const ys = rects.flatMap((r) => [r.y, r.y + r.height]);
  return [Math.min(...ys), Math.max(...ys)];
}
