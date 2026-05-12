export type Unit = "in" | "cm";

export type Frame = {
  matWidth: number;
  frameWidth: number;
  frameColor: string;
};

export type Item = {
  id: string;
  name: string;
  imageDataUrl: string;
  // When the user removes the background, the original image is moved here
  // so they can toggle back. Null when the background hasn't been removed.
  imageOriginalDataUrl?: string | null;
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
};

export type RoomSummary = {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
};
