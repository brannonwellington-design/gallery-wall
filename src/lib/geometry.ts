// Shared physical geometry for pieces and walls. Pure functions, all mm.
// Wall origin is top-left; y grows downward (canvas convention).

import { DEFAULT_EYE_LINE_HEIGHT_MM } from "./defaults";
import type { Item, Room } from "./types";

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
