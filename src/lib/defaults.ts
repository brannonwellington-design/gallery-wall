import type { Room } from "./types";
import { toMm } from "./units";

// Museum standard: 57" from floor to the center of the artwork.
export const DEFAULT_EYE_LINE_HEIGHT_MM = toMm(57, "in");

export function makeDefaultRoom(): Room {
  return {
    name: "Untitled room",
    wallWidth: toMm(120, "in"),
    wallHeight: toMm(96, "in"),
    unit: "in",
    items: [],
    eyeLineHeight: DEFAULT_EYE_LINE_HEIGHT_MM,
    eyeLineEnabled: true,
  };
}

export const DEFAULT_ROOM: Room = makeDefaultRoom();
