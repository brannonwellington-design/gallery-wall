import type { Frame, Room } from "./types";
import { toMm } from "./units";

/** Frame a new piece gets: 2" mat, 3/4" frame, near-black moulding. */
export const DEFAULT_FRAME: Frame = {
  matWidth: toMm(2, "in"),
  frameWidth: toMm(0.75, "in"),
  frameColor: "#1f1f1f",
};

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
