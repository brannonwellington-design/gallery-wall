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
  wallWidth: number;
  wallHeight: number;
  unit: Unit;
  items: Item[];
};
