import { describe, expect, it } from "vitest";
import { computeSpacingSegments } from "@/lib/spacing";

const wall = { width: 3000, height: 2400 };

describe("computeSpacingSegments", () => {
  it("measures the gap between side-by-side pieces once", () => {
    const segs = computeSpacingSegments(
      [
        { id: "a", x: 100, y: 500, width: 400, height: 300 },
        { id: "b", x: 600, y: 500, width: 400, height: 300 },
      ],
      wall,
    );
    const between = segs.filter((s) => s.between === "items");
    expect(between).toHaveLength(1);
    expect(between[0]).toMatchObject({ kind: "h", distance: 100 });
  });

  it("ignores pieces hanging off the wall", () => {
    const segs = computeSpacingSegments([{ id: "a", x: -50, y: 0, width: 100, height: 100 }], wall);
    expect(segs).toEqual([]);
  });
});
