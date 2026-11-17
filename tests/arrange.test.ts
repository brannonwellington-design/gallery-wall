import { describe, expect, it } from "vitest";
import { alignItems, centerItemsAt, distributeItems, duplicateItems, moveItems } from "@/lib/arrange";
import { outerRect } from "@/lib/geometry";
import { item } from "./helpers";

const a = item({ id: "a", x: 0, y: 100, artWidth: 200, artHeight: 100 });
const b = item({ id: "b", x: 400, y: 0, artWidth: 100, artHeight: 300 });
const c = item({ id: "c", x: 1000, y: 50, artWidth: 300, artHeight: 200 });
const framed = item({ id: "f", x: 50, y: 500, artWidth: 100, artHeight: 100, frame: { matWidth: 20, frameWidth: 10, frameColor: "#000" } });
const all = new Set(["a", "b", "c"]);
const byId = (items: ReturnType<typeof alignItems>) => Object.fromEntries(items.map((i) => [i.id, i]));

describe("alignItems", () => {
  it("aligns tops and bottoms", () => {
    const top = byId(alignItems([a, b, c], all, "top"));
    expect([top.a.y, top.b.y, top.c.y]).toEqual([0, 0, 0]);
    const bottom = byId(alignItems([a, b, c], all, "bottom"));
    expect([bottom.a.y + 100, bottom.b.y + 300, bottom.c.y + 200]).toEqual([300, 300, 300]);
  });

  it("centers horizontally on the selection's middle", () => {
    const out = byId(alignItems([a, b, c], all, "hcenter"));
    expect(out.a.x + 100).toBeCloseTo(650);
    expect(out.c.x + 150).toBeCloseTo(650);
  });

  it("uses the framed outer box", () => {
    const out = byId(alignItems([a, framed], new Set(["a", "f"]), "left"));
    expect(outerRect(out.f).x).toBe(0);
  });

  it("leaves unselected pieces and single selections alone", () => {
    expect(alignItems([a, b, c], new Set(["a"]), "left")).toEqual([a, b, c]);
    expect(byId(alignItems([a, b, c], new Set(["a", "b"]), "top")).c).toBe(c);
  });
});

describe("distributeItems", () => {
  it("evens out the gaps, keeping the outer pieces in place", () => {
    const out = byId(distributeItems([a, b, c], all, "x"));
    expect(out.a.x).toBe(0);
    expect(out.c.x).toBe(1000);
    const gap1 = out.b.x - 200;
    const gap2 = 1000 - (out.b.x + 100);
    expect(gap1).toBeCloseTo(gap2);
  });

  it("applies an exact gap when given", () => {
    const out = byId(distributeItems([a, b], new Set(["a", "b"]), "x", 76.2));
    expect(out.b.x).toBeCloseTo(276.2);
  });

  it("needs three pieces to distribute evenly", () => {
    expect(distributeItems([a, b], new Set(["a", "b"]), "x")).toEqual([a, b]);
  });
});

describe("moving and duplicating", () => {
  it("centers the selection as a block", () => {
    const out = centerItemsAt([a, b, c], new Set(["a", "b"]), 1000);
    const r = out.filter((i) => i.id !== "c").map(outerRect);
    const mid = (Math.min(...r.map((x) => x.x)) + Math.max(...r.map((x) => x.x + x.width))) / 2;
    expect(mid).toBeCloseTo(1000);
    expect(out[2]).toBe(c);
  });

  it("moves only the selection", () => {
    const out = byId(moveItems([a, b], new Set(["b"]), 10, -5));
    expect(out.a).toBe(a);
    expect([out.b.x, out.b.y]).toEqual([410, -5]);
  });

  it("duplicates with new ids, an offset, and no pin", () => {
    let n = 0;
    const copies = duplicateItems([{ ...a, pinned: true }, b], new Set(["a"]), () => `copy${++n}`);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ id: "copy1", x: 50.8, y: 150.8, pinned: false, imageSrc: a.imageSrc });
  });
});

describe("pinned pieces", () => {
  const pinned = { ...b, pinned: true };
  it("never move, and act as the alignment anchor", () => {
    const out = Object.fromEntries(alignItems([a, pinned, c], all, "top").map((i) => [i.id, i]));
    expect(out.b.y).toBe(pinned.y);
    expect(out.a.y).toBe(pinned.y);
    expect(out.c.y).toBe(pinned.y);
  });
  it("aren't nudged or centered", () => {
    expect(moveItems([pinned], new Set(["b"]), 10, 10)[0]).toBe(pinned);
    expect(centerItemsAt([a, pinned], new Set(["a", "b"]), 2000)).toEqual([a, pinned]);
  });
});
