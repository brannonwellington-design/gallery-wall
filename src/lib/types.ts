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
