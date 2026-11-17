import { describe, expect, it } from "vitest";
import { computeSnap } from "@/lib/snap";

const wall = { width: 3000, height: 2400 };

describe("computeSnap", () => {
  it("returns the raw position when snapping is off", () => {
    const r = computeSnap({
      dragged: { x: 3, y: 7, width: 100, height: 100 },
      others: [],
      wall,
      threshold: 10,
      enabled: false,
    });
    expect(r).toEqual({ x: 3, y: 7, guides: [] });
  });

  it("snaps to the wall's left edge within the threshold", () => {
    const r = computeSnap({
      dragged: { x: 4, y: 900, width: 100, height: 100 },
      others: [],
      wall,
      threshold: 10,
      enabled: true,
    });
    expect(r.x).toBe(0);
    expect(r.guides.some((g) => g.kind === "v" && g.reason === "wall-edge")).toBe(true);
  });

  it("centers on the wall's vertical center line", () => {
    const r = computeSnap({
      dragged: { x: 1447, y: 900, width: 100, height: 100 },
      others: [],
      wall,
      threshold: 10,
      enabled: true,
    });
    expect(r.x + 50).toBe(1500);
  });

  it("aligns tops with a neighbouring piece", () => {
    const r = computeSnap({
      dragged: { x: 800, y: 503, width: 100, height: 100 },
      others: [{ x: 300, y: 500, width: 200, height: 200 }],
      wall,
      threshold: 10,
      enabled: true,
    });
    expect(r.y).toBe(500);
  });

  it("magnetises the piece's center to the eye line", () => {
    const r = computeSnap({
      dragged: { x: 800, y: 905, width: 100, height: 200 },
      others: [],
      wall,
      threshold: 10,
      enabled: true,
      eyeLineY: 1000,
    });
    expect(r.y + 100).toBe(1000);
    expect(r.guides.some((g) => g.reason === "eye-line")).toBe(true);
  });

  it("leaves positions alone outside the threshold", () => {
    const r = computeSnap({
      dragged: { x: 600, y: 650, width: 100, height: 100 },
      others: [],
      wall,
      threshold: 5,
      enabled: true,
    });
    expect(r).toMatchObject({ x: 600, y: 650 });
  });
});
