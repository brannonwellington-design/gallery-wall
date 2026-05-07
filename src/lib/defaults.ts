import type { Room } from "./types";
import { toMm } from "./units";

export function makeDefaultRoom(): Room {
  return {
    name: "Untitled room",
    wallWidth: toMm(120, "in"),
    wallHeight: toMm(96, "in"),
    unit: "in",
    items: [],
  };
}

export const DEFAULT_ROOM: Room = makeDefaultRoom();
