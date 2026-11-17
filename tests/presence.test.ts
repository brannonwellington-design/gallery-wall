import { describe, expect, it } from "vitest";
import { colorFor, initials, PRESENCE_TTL_MS, updatePresence, type PresenceEntry } from "@/lib/presence";

const entry = (id: string, seen: number): PresenceEntry => ({ sessionId: id, name: id, color: "#000", selection: [], seen });

describe("presence", () => {
  it("adds, refreshes and expires people", () => {
    const now = 1_000_000;
    const before = { a: entry("a", now - 1000), stale: entry("stale", now - PRESENCE_TTL_MS - 1) };
    const next = updatePresence(before, entry("b", now), null, now);
    expect(Object.keys(next).sort()).toEqual(["a", "b"]);
  });

  it("removes someone who leaves", () => {
    const now = 5000;
    expect(Object.keys(updatePresence({ a: entry("a", now), b: entry("b", now) }, null, "a", now))).toEqual(["b"]);
  });

  it("gives each session a stable color and readable initials", () => {
    expect(colorFor("abc")).toBe(colorFor("abc"));
    expect(initials("Brannon Wellington")).toBe("BW");
    expect(initials("guest")).toBe("G");
    expect(initials("  ")).toBe("?");
  });
});
