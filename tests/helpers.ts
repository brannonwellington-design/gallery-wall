import type { Item, Room } from "@/lib/types";

export function item(overrides: Partial<Item> = {}): Item {
  return {
    id: overrides.id ?? "piece1",
    name: "Piece",
    imageSrc: "https://example.supabase.co/storage/v1/object/public/room-images/r/p.jpg",
    artWidth: 400,
    artHeight: 300,
    frame: null,
    x: 0,
    y: 0,
    ...overrides,
  };
}

export function room(overrides: Partial<Room> = {}): Room {
  return {
    name: "Test room",
    wallWidth: 3000,
    wallHeight: 2400,
    unit: "in",
    items: [],
    ...overrides,
  };
}
