import { describe, expect, it } from "vitest";
import { outerRect } from "@/lib/geometry";
import { randomizeLayout } from "@/lib/layout";
import type { Item } from "@/lib/types";
import { item } from "./helpers";

const wall = { width: 3000, height: 2400 };

function overlaps(a: Item, b: Item) {
  const r1 = outerRect(a);
  const r2 = outerRect(b);
  return (
    r1.x < r2.x + r2.width - 0.01 &&
    r2.x < r1.x + r1.width - 0.01 &&
    r1.y < r2.y + r2.height - 0.01 &&
    r2.y < r1.y + r1.height - 0.01
  );
}

const pieces = Array.from({ length: 8 }, (_, i) =>
  item({
    id: `p${i}`,
    artWidth: 200 + (i % 3) * 100,
    artHeight: 250 + (i % 2) * 120,
    frame: i % 2 ? { matWidth: 40, frameWidth: 15, frameColor: "#000" } : null,
  }),
);

describe("randomizeLayout", () => {
  // Layout picks a random template; run it a few times to cover each.
  for (let run = 0; run < 12; run++) {
    it(`places every piece on the wall without overlaps (run ${run + 1})`, () => {
      const { items, template } = randomizeLayout(pieces, wall, 1000);
      expect(template).not.toBeNull();
      expect(items).toHaveLength(pieces.length);
      for (const it of items) {
        const r = outerRect(it);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(wall.width + 0.01);
        expect(r.y + r.height).toBeLessThanOrEqual(wall.height + 0.01);
      }
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          expect(overlaps(items[i], items[j])).toBe(false);
        }
      }
    });
  }

  it("never moves pinned pieces", () => {
    const pinned = item({ id: "pinned", x: 100, y: 100, pinned: true });
    const { items } = randomizeLayout([pinned, ...pieces.slice(0, 4)], wall, 1000);
    expect(items.find((i) => i.id === "pinned")).toMatchObject({ x: 100, y: 100 });
  });

  it("reports failure instead of overlapping when nothing fits", () => {
    const huge = [item({ id: "a", artWidth: 2900, artHeight: 2300 }), item({ id: "b", artWidth: 2900, artHeight: 2300 })];
    const { items, template } = randomizeLayout(huge, wall, null);
    expect(template).toBeNull();
    expect(items).toEqual(huge);
  });
});
