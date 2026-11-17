import { describe, expect, it } from "vitest";
import { mergeRooms } from "@/lib/mergeRooms";
import { item, room } from "./helpers";

const base = room({
  name: "Hall",
  items: [item({ id: "a", x: 0 }), item({ id: "b", x: 500 }), item({ id: "c", x: 1000 })],
});
const ids = (r: { items: { id: string }[] }) => r.items.map((i) => i.id);
const byId = (r: { items: { id: string; x: number; y: number; name: string }[] }) =>
  Object.fromEntries(r.items.map((i) => [i.id, i]));

describe("mergeRooms", () => {
  it("combines edits to different pieces", () => {
    const local = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, x: 11 } : i)) };
    const server = { ...base, items: base.items.map((i) => (i.id === "b" ? { ...i, x: 22 } : i)) };
    const { room: m, report } = mergeRooms(base, local, server);
    expect(byId(m).a.x).toBe(11);
    expect(byId(m).b.x).toBe(22);
    expect(report.conflicts).toBe(0);
  });

  it("combines different fields of the same piece", () => {
    const local = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, name: "Renamed" } : i)) };
    const server = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, y: 300 } : i)) };
    const a = byId(mergeRooms(base, local, server).room).a;
    expect([a.name, a.y]).toEqual(["Renamed", 300]);
  });

  it("keeps local where both changed the same field, and counts it", () => {
    const local = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, x: 1 } : i)) };
    const server = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, x: 2 } : i)) };
    const { room: m, report } = mergeRooms(base, local, server);
    expect(byId(m).a.x).toBe(1);
    expect(report.conflicts).toBe(1);
  });

  it("keeps additions from both sides", () => {
    const local = { ...base, items: [...base.items, item({ id: "mine" })] };
    const server = { ...base, items: [...base.items, item({ id: "theirs" })] };
    expect(ids(mergeRooms(base, local, server).room)).toEqual(["a", "b", "c", "theirs", "mine"]);
  });

  it("applies deletions, unless the other side edited that piece", () => {
    const local = { ...base, items: base.items.filter((i) => i.id !== "a") };
    const server = { ...base, items: base.items.filter((i) => i.id !== "c") };
    expect(ids(mergeRooms(base, local, server).room)).toEqual(["b"]);

    const serverEdited = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, x: 99 } : i)) };
    expect(ids(mergeRooms(base, local, serverEdited).room)).toEqual(["a", "b", "c"]);
  });

  it("merges room settings and fixtures the same way", () => {
    const local = { ...base, name: "Hallway" };
    const server = {
      ...base,
      wallWidth: 4000,
      fixtures: [{ id: "s", kind: "sofa" as const, x: 0, y: 1500, width: 2000, height: 900 }],
    };
    const m = mergeRooms(base, local, server).room;
    expect([m.name, m.wallWidth, m.fixtures?.length]).toEqual(["Hallway", 4000, 1]);
  });

  it("ignores key order differences between editor and server copies", () => {
    const reordered = (r: typeof base) => ({
      ...r,
      items: r.items.map(({ id, name, ...rest }) => ({ ...rest, name, id })),
    });
    const local = { ...base, items: base.items.map((i) => (i.id === "a" ? { ...i, x: 5 } : i)) };
    const { report } = mergeRooms(base, local, reordered(base));
    expect(report.conflicts).toBe(0);
  });

  it("is a no-op when nothing changed locally", () => {
    const server = { ...base, items: base.items.map((i) => ({ ...i, y: 7 })) };
    expect(mergeRooms(base, base, server).room).toEqual(server);
  });
});
