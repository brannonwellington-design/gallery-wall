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
};

export type RoomSummary = {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
};
