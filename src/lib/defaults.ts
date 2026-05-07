import type { Room } from "./types";
import { toMm } from "./units";

export const DEFAULT_ROOM: Room = {
  wallWidth: toMm(120, "in"),
  wallHeight: toMm(96, "in"),
  unit: "in",
  items: [],
};

export const STORAGE_KEY = "gallery-wall:room:v1";
