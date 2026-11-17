import { describe, expect, it } from "vitest";
import {
  constrainFixture,
  FURNITURE_CLEARANCE_MM,
  keepOutRect,
  layoutContextFor,
  makeFixture,
} from "@/lib/fixtures";
import { outerRect } from "@/lib/geometry";
import { buildHangingGuide } from "@/lib/hangingGuide";
import { randomizeLayout } from "@/lib/layout";
import { toMm } from "@/lib/units";
import { item, room } from "./helpers";

const inch = (n: number) => toMm(n, "in");
const wall = { wallWidth: inch(144), wallHeight: inch(96) };

describe("fixtures", () => {
  it("places new furniture on the floor, centered", () => {
    const sofa = makeFixture("sofa", wall, "s1");
    expect(sofa.y + sofa.height).toBeCloseTo(wall.wallHeight);
    expect(sofa.x + sofa.width / 2).toBeCloseTo(wall.wallWidth / 2);
  });

  it("puts outlets near the floor and switches at hand height", () => {
    expect(wall.wallHeight - makeFixture("outlet", wall, "o").y - inch(5)).toBeCloseTo(inch(12));
    expect(wall.wallHeight - makeFixture("switch", wall, "w").y - inch(5)).toBeCloseTo(inch(46));
  });

  it("keeps floor fixtures on the floor and everything on the wall", () => {
    const sofa = makeFixture("sofa", wall, "s1");
    expect(constrainFixture({ ...sofa, y: 0 }, wall).y).toBeCloseTo(sofa.y);
    expect(constrainFixture({ ...sofa, x: -500 }, wall).x).toBe(0);
    const win = makeFixture("window", wall, "w1");
    expect(constrainFixture({ ...win, y: -100 }, wall).y).toBe(0);
  });

  it("adds a clearance band above furniture only", () => {
    const sofa = makeFixture("sofa", wall, "s1");
    expect(keepOutRect(sofa).y).toBeCloseTo(sofa.y - FURNITURE_CLEARANCE_MM);
    const door = makeFixture("door", wall, "d1");
    expect(keepOutRect(door).y).toBe(door.y);
  });
});

describe("randomize with a sofa", () => {
  const sofa = { ...makeFixture("sofa", wall, "s1"), x: inch(20) };
  const r = room({
    ...wall,
    fixtures: [sofa],
    items: Array.from({ length: 5 }, (_, i) => item({ id: `p${i}`, artWidth: inch(12 + i * 2), artHeight: inch(16) })),
  });

  for (let run = 0; run < 8; run++) {
    it(`keeps every piece out of the sofa's clearance band (run ${run + 1})`, () => {
      const ctx = layoutContextFor(r);
      const { items, template } = randomizeLayout(r.items, { width: r.wallWidth, height: r.wallHeight }, inch(96 - 57), undefined, ctx);
      expect(template).not.toBeNull();
      const band = keepOutRect(sofa);
      for (const it of items) {
        const rect = outerRect(it);
        const hits =
          rect.x < band.x + band.width && band.x < rect.x + rect.width &&
          rect.y < band.y + band.height && band.y < rect.y + rect.height;
        expect(hits).toBe(false);
      }
    });
  }

  it("works around a switch sitting right where the arrangement wants to go", () => {
    const sofaCentered = makeFixture("sofa", wall, "s2");
    const sw = { ...makeFixture("switch", wall, "w1"), x: wall.wallWidth / 2 - inch(1.5) };
    const blocked = room({ ...wall, fixtures: [sofaCentered, sw], items: r.items });
    for (let run = 0; run < 6; run++) {
      const { items, template } = randomizeLayout(
        blocked.items,
        { width: blocked.wallWidth, height: blocked.wallHeight },
        inch(96 - 57),
        undefined,
        layoutContextFor(blocked),
      );
      expect(template).not.toBeNull();
      for (const it of items) {
        const rect = outerRect(it);
        const hitsSwitch =
          rect.x < sw.x + sw.width && sw.x < rect.x + rect.width &&
          rect.y < sw.y + sw.height && sw.y < rect.y + rect.height;
        expect(hitsSwitch).toBe(false);
      }
    }
  });

  it("centers the arrangement over the sofa", () => {
    const ctx = layoutContextFor(r);
    expect(ctx.centerX).toBeCloseTo(sofa.x + sofa.width / 2);
    expect(ctx.maxBottom).toBeCloseTo(sofa.y - FURNITURE_CLEARANCE_MM);
  });
});

describe("hanging guide with fixtures", () => {
  it("reports the gap above furniture and flags covered fixtures", () => {
    const sofa = makeFixture("sofa", wall, "s1");
    const sw = { ...makeFixture("switch", wall, "w1"), x: inch(5) };
    const r = room({
      ...wall,
      fixtures: [sofa, sw],
      items: [
        item({ id: "over", x: sofa.x + inch(10), y: sofa.y - inch(10) - inch(16), artWidth: inch(20), artHeight: inch(16) }),
        item({ id: "low", x: sofa.x + inch(40), y: sofa.y - inch(3) - inch(16), artWidth: inch(20), artHeight: inch(16) }),
        item({ id: "switch", x: inch(2), y: sw.y - inch(2), artWidth: inch(10), artHeight: inch(10) }),
      ],
    });
    const rows = Object.fromEntries(buildHangingGuide(r).map((row) => [row.item.id, row]));
    expect(rows.over.above?.gap).toBeCloseTo(inch(10));
    expect(rows.over.warnings.some((w) => w.startsWith("Close to"))).toBe(false);
    expect(rows.low.warnings.some((w) => w.startsWith("Close to the sofa"))).toBe(true);
    expect(rows.switch.warnings).toContain("Covers the light switch");
  });
});
