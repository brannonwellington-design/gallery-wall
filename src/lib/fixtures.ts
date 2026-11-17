// Catalogue of fixtures (furniture, openings, electrical) and the rules
// for how art relates to them. Sizes are typical US defaults the user can
// edit after adding.

import type { Fixture, FixtureKind, Room } from "./types";
import { toMm } from "./units";

type Preset = {
  label: string;
  /** Typical size in inches. */
  width: number;
  height: number;
  /** Inches from the floor to the bottom edge. */
  bottom: number;
  /** Stands on the floor: drag only moves it sideways. */
  onFloor: boolean;
  /** Furniture art hangs above, with a clearance band. */
  furniture: boolean;
};

export const FIXTURE_PRESETS: Record<FixtureKind, Preset> = {
  sofa: { label: "Sofa", width: 84, height: 34, bottom: 0, onFloor: true, furniture: true },
  console: { label: "Console / dresser", width: 48, height: 32, bottom: 0, onFloor: true, furniture: true },
  bed: { label: "Bed headboard", width: 64, height: 48, bottom: 0, onFloor: true, furniture: true },
  door: { label: "Door", width: 36, height: 80, bottom: 0, onFloor: true, furniture: false },
  window: { label: "Window", width: 36, height: 48, bottom: 30, onFloor: false, furniture: false },
  tv: { label: "TV", width: 57, height: 33, bottom: 36, onFloor: false, furniture: false },
  sconce: { label: "Sconce", width: 6, height: 12, bottom: 60, onFloor: false, furniture: false },
  switch: { label: "Light switch", width: 3, height: 5, bottom: 46, onFloor: false, furniture: false },
  outlet: { label: "Outlet", width: 3, height: 5, bottom: 12, onFloor: false, furniture: false },
  other: { label: "Other", width: 24, height: 24, bottom: 36, onFloor: false, furniture: false },
};

export const FIXTURE_KINDS = Object.keys(FIXTURE_PRESETS) as FixtureKind[];

/**
 * Designers hang art 6–10" above furniture; 8" is the common rule. Snapping
 * offers this line and Randomize keeps art above it.
 */
export const FURNITURE_CLEARANCE_MM = toMm(8, "in");

export function fixtureLabel(f: Pick<Fixture, "kind" | "label">): string {
  return f.label?.trim() || FIXTURE_PRESETS[f.kind].label;
}

export function isOnFloor(f: Pick<Fixture, "kind">): boolean {
  return FIXTURE_PRESETS[f.kind].onFloor;
}

export function isFurniture(f: Pick<Fixture, "kind">): boolean {
  return FIXTURE_PRESETS[f.kind].furniture;
}

/** A new fixture of `kind`, centered on the wall at its typical height. */
export function makeFixture(kind: FixtureKind, room: Pick<Room, "wallWidth" | "wallHeight">, id: string): Fixture {
  const p = FIXTURE_PRESETS[kind];
  const width = Math.min(toMm(p.width, "in"), room.wallWidth);
  const height = Math.min(toMm(p.height, "in"), room.wallHeight);
  const bottom = toMm(p.bottom, "in");
  // Switches and outlets usually sit near a wall's end, not mid-wall.
  const nearEdge = kind === "switch" || kind === "outlet";
  return {
    id,
    kind,
    x: nearEdge ? Math.min(toMm(6, "in"), room.wallWidth - width) : (room.wallWidth - width) / 2,
    y: Math.max(0, room.wallHeight - bottom - height),
    width,
    height,
  };
}

/** Keep a fixture on the wall; floor-standing ones stay on the floor. */
export function constrainFixture(f: Fixture, room: Pick<Room, "wallWidth" | "wallHeight">): Fixture {
  const width = Math.min(f.width, room.wallWidth);
  const height = Math.min(f.height, room.wallHeight);
  const x = Math.max(0, Math.min(f.x, room.wallWidth - width));
  const y = isOnFloor(f)
    ? room.wallHeight - height
    : Math.max(0, Math.min(f.y, room.wallHeight - height));
  return { ...f, x, y, width, height };
}

/** What art should keep clear of: the fixture, plus a band above furniture. */
export function keepOutRect(f: Fixture): { x: number; y: number; width: number; height: number } {
  if (!isFurniture(f)) return { x: f.x, y: f.y, width: f.width, height: f.height };
  return {
    x: f.x,
    y: f.y - FURNITURE_CLEARANCE_MM,
    width: f.width,
    height: f.height + FURNITURE_CLEARANCE_MM,
  };
}

/**
 * Randomize's view of the room: every fixture (with clearance above
 * furniture) is an obstacle, and when there's furniture the arrangement is
 * centered over the widest piece and kept above its clearance line.
 */
export function layoutContextFor(room: Pick<Room, "fixtures">): {
  obstacles: { x: number; y: number; width: number; height: number }[];
  centerX?: number;
  maxBottom?: number;
} {
  const fixtures = room.fixtures ?? [];
  const obstacles = fixtures.map(keepOutRect);
  const anchor = fixtures
    .filter(isFurniture)
    .sort((a, b) => b.width - a.width)[0];
  if (!anchor) return { obstacles };
  return {
    obstacles,
    centerX: anchor.x + anchor.width / 2,
    maxBottom: keepOutRect(anchor).y,
  };
}
