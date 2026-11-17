export type Unit = "in" | "cm";

export type Frame = {
  matWidth: number;
  frameWidth: number;
  frameColor: string;
};

/** How a piece hangs: what the nail(s) catch, measured on the piece itself. */
export type Hanger = {
  /** One hook at the center (picture wire, sawtooth) or two (D-rings). */
  kind: "single" | "pair";
  /** mm from the top of the piece down to where the nail sits (wire pulled taut). */
  drop: number;
  /** mm between the two hooks, centered on the piece (pair only). */
  spacing: number;
};

export type Item = {
  id: string;
  name: string;
  imageSrc: string;
  // When the user removes the background, the original image is moved here
  // so they can toggle back. Null when the background hasn't been removed.
  imageOriginalSrc?: string | null;
  artWidth: number;
  artHeight: number;
  // Background removal auto-crops the image to the visible art, then
  // shrinks artWidth/artHeight by the same ratio so frame/matte hug it.
  // These stash the pre-crop physical dims so toggling background back on
  // restores the original box. Null when no crop was applied.
  artWidthOriginal?: number | null;
  artHeightOriginal?: number | null;
  frame: Frame | null;
  x: number;
  y: number;
  // When true, the Randomize action leaves this piece's position alone
  // and the layout engine treats it as a fixed obstacle.
  pinned?: boolean;
  // Hanging hardware. Null/absent means "not measured yet": the hanging
  // guide assumes DEFAULT_HANGER and flags it.
  hanger?: Hanger | null;
};

/** Things on or in front of the wall that art has to work around. */
export type FixtureKind =
  | "sofa"
  | "console"
  | "bed"
  | "door"
  | "window"
  | "tv"
  | "outlet"
  | "switch"
  | "sconce"
  | "other";

export type Fixture = {
  id: string;
  kind: FixtureKind;
  /** Optional name shown on the wall, e.g. "Bookshelf". */
  label?: string;
  /** mm, same convention as pieces: x from the left, y from the top. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Room = {
  name: string;
  wallWidth: number;
  wallHeight: number;
  unit: Unit;
  items: Item[];
  // Gallery eye line: a horizontal guide measured from the floor up to the
  // center of artwork. Default 57" (museum standard). When enabled,
  // dragged pieces snap their vertical center to this height.
  eyeLineHeight?: number;
  eyeLineEnabled?: boolean;
  // Furniture, doors, windows, outlets etc. Absent on older rooms.
  fixtures?: Fixture[];
};

export type RoomSummary = {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
};

/** Room contents plus persistence metadata. */
export type RoomRecord = {
  room: Room;
  updatedAt: string;
};
