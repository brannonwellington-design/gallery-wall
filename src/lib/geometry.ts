// Shared physical geometry for pieces and walls. Pure functions, all mm.
// Wall origin is top-left; y grows downward (canvas convention).

import { DEFAULT_EYE_LINE_HEIGHT_MM, DEFAULT_HANGER } from "./defaults";
import type { Hanger, Item, Room } from "./types";

export type Rect = { x: number; y: number; width: number; height: number };

/** Mat + frame thickness on each side of the art (0 for unframed pieces). */
export function framePadding(item: Pick<Item, "frame">): number {
  return (item.frame?.frameWidth ?? 0) + (item.frame?.matWidth ?? 0);
}

/** Outer size of a piece as it hangs: art plus mat and frame on both sides. */
export function outerSize(item: Pick<Item, "artWidth" | "artHeight" | "frame">): {
  width: number;
  height: number;
} {
  const pad = framePadding(item);
  return { width: item.artWidth + pad * 2, height: item.artHeight + pad * 2 };
}

/** Outer rectangle of a piece on the wall. */
export function outerRect(item: Item): Rect {
  return { x: item.x, y: item.y, ...outerSize(item) };
}

export type EyeLine = {
  /** Eye line as distance from the top of the wall (null when off). */
  y: number;
  /** Requested height above the floor. */
  heightFromFloor: number;
  /** True when the requested height doesn't fit on the wall and was clamped. */
  clamped: boolean;
};

/**
 * Where the eye line sits on the wall, or null when it's disabled. The
 * stored value is height above the floor; layout and canvas code want
 * distance from the top, clamped onto the wall for short feature walls.
 */
export function eyeLine(room: Pick<Room, "wallHeight" | "eyeLineEnabled" | "eyeLineHeight">): EyeLine | null {
  const enabled = room.eyeLineEnabled ?? true;
  const height = room.eyeLineHeight ?? DEFAULT_EYE_LINE_HEIGHT_MM;
  if (!enabled || !(height > 0) || !(room.wallHeight > 0)) return null;
  const y = Math.max(0, Math.min(room.wallHeight - height, room.wallHeight));
  return { y, heightFromFloor: height, clamped: height >= room.wallHeight };
}

/** The piece's hanger, or the default with `assumed: true` when unset. */
export function hangerOf(item: Pick<Item, "hanger">): Hanger & { assumed: boolean } {
  return item.hanger ? { ...item.hanger, assumed: false } : { ...DEFAULT_HANGER, assumed: true };
}

export type NailPoint = {
  /** mm from the left edge of the wall. */
  fromLeft: number;
  /** mm from the top of the wall (canvas convention). */
  y: number;
  /** mm above the floor. */
  fromFloor: number;
};

/**
 * Where the nail(s) go on the wall for a piece, given its position and
 * hanger. Single hooks sit on the piece's vertical center line; pairs sit
 * `spacing` apart, centered. Drop is clamped to the piece's height.
 */
export function nailPoints(item: Item, wallHeight: number): NailPoint[] {
  const { width, height } = outerSize(item);
  const hanger = hangerOf(item);
  const drop = Math.max(0, Math.min(hanger.drop, height));
  const y = item.y + drop;
  const cx = item.x + width / 2;
  const xs =
    hanger.kind === "pair"
      ? [cx - hanger.spacing / 2, cx + hanger.spacing / 2]
      : [cx];
  return xs.map((x) => ({ fromLeft: x, y, fromFloor: wallHeight - y }));
}
