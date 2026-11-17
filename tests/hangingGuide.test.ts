import { describe, expect, it } from "vitest";
import { hangerOf, nailPoints } from "@/lib/geometry";
import { buildHangingGuide } from "@/lib/hangingGuide";
import { formatTape, toMm } from "@/lib/units";
import { item, room } from "./helpers";

const inch = (n: number) => toMm(n, "in");

describe("formatTape", () => {
  it.each([
    [inch(57), '57"'],
    [inch(57.375), '57 3/8"'],
    [inch(12.5), '12 1/2"'],
    [inch(0.25), '1/4"'],
    [inch(10.06), '10"'], // rounds to nearest 1/8
    [inch(3.95), '4"'], // rounds up to the next inch
  ])("%s mm reads %s", (mm, text) => expect(formatTape(mm, "in")).toBe(text));

  it("uses one decimal in centimetres", () => {
    expect(formatTape(1457, "cm")).toBe("145.7 cm");
  });
});

describe("nailPoints", () => {
  const wallH = inch(96);

  it("puts one hook on the center line, drop below the top", () => {
    const p = item({ x: inch(10), y: inch(30), artWidth: inch(20), artHeight: inch(16), hanger: { kind: "single", drop: inch(3), spacing: 0 } });
    const [n] = nailPoints(p, wallH);
    expect(n.fromLeft).toBeCloseTo(inch(20));
    expect(n.fromFloor).toBeCloseTo(inch(96 - 33));
  });

  it("spaces two hooks around the center", () => {
    const p = item({ x: 0, y: 0, artWidth: inch(30), artHeight: inch(20), hanger: { kind: "pair", drop: inch(4), spacing: inch(16) } });
    const nails = nailPoints(p, wallH);
    expect(nails.map((n) => n.fromLeft)).toEqual([inch(7), inch(23)].map((v) => expect.closeTo(v, 5)));
    expect(nails[0].fromFloor).toBeCloseTo(nails[1].fromFloor);
  });

  it("includes the frame in the piece's outer size", () => {
    const p = item({ x: 0, y: 0, artWidth: inch(10), artHeight: inch(10), frame: { matWidth: inch(2), frameWidth: inch(1), frameColor: "#000" }, hanger: { kind: "single", drop: inch(1), spacing: 0 } });
    expect(nailPoints(p, wallH)[0].fromLeft).toBeCloseTo(inch(8)); // (10 + 2*3) / 2
  });

  it("assumes a 2 inch wire drop when unmeasured", () => {
    expect(hangerOf(item())).toMatchObject({ kind: "single", assumed: true });
    expect(hangerOf(item()).drop).toBeCloseTo(inch(2));
  });
});

describe("buildHangingGuide", () => {
  it("numbers pieces left to right and flags problems", () => {
    const r = room({
      wallWidth: inch(120),
      wallHeight: inch(96),
      items: [
        item({ id: "right", x: inch(80), y: inch(30) }),
        item({ id: "left", x: inch(10), y: inch(30), hanger: { kind: "single", drop: inch(2), spacing: 0 } }),
        item({ id: "off", x: inch(118), y: inch(10) }),
      ],
    });
    const rows = buildHangingGuide(r);
    expect(rows.map((row) => row.item.id)).toEqual(["left", "right", "off"]);
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(rows[0].warnings).toEqual([]);
    expect(rows[2].warnings).toContain("Hangs past the edge of the wall");
    expect(rows[1].warnings.some((w) => w.startsWith("Hanger not measured"))).toBe(true);
  });
});
