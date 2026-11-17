import { beforeEach, describe, expect, it, vi } from "vitest";
import { item, room } from "./helpers";

// A fake Supabase bucket: folder -> files with creation times.
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-17T12:00:00Z");
let bucket: Record<string, { name: string; created_at: string }[]>;
const removed: string[] = [];

vi.mock("@/lib/server/supabase", () => ({
  IMAGE_BUCKET: "room-images",
  getServiceClient: () => ({
    storage: {
      from: () => ({
        list: async (prefix: string) => {
          if (prefix === "") {
            return { data: Object.keys(bucket).map((name) => ({ name, id: null })), error: null };
          }
          return {
            data: (bucket[prefix] ?? []).map((f) => ({ ...f, id: `${prefix}/${f.name}` })),
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { error: null };
        },
      }),
    },
  }),
}));

process.env.SUPABASE_URL = "https://proj.supabase.co";
const url = (path: string) =>
  `https://proj.supabase.co/storage/v1/object/public/room-images/${path}`;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("sweepOrphanedImages", () => {
  beforeEach(() => {
    removed.length = 0;
    bucket = {
      roomA: [
        { name: "p1-main-aaa.jpg", created_at: ago(30) }, // in use
        { name: "p1-original-bbb.jpg", created_at: ago(30) }, // in use as original
        { name: "gone-main-ccc.jpg", created_at: ago(30) }, // orphan, old -> delete
        { name: "gone-main-ddd.jpg", created_at: ago(2) }, // orphan, recent -> keep
      ],
      roomB: [{ name: "shared-main-eee.jpg", created_at: ago(30) }], // used by roomA's copy
      deletedRoom: [{ name: "x-main-fff.jpg", created_at: ago(30) }], // room deleted -> delete
    };
  });

  it("deletes only old, unreferenced files", async () => {
    const { sweepOrphanedImages } = await import("@/lib/imageStore");
    const rooms = [
      room({
        items: [
          item({ id: "p1", imageSrc: url("roomA/p1-main-aaa.jpg"), imageOriginalSrc: url("roomA/p1-original-bbb.jpg") }),
          item({ id: "s", imageSrc: url("roomB/shared-main-eee.jpg") }),
        ],
      }),
    ];
    const result = await sweepOrphanedImages(rooms, { minAgeMs: 7 * DAY, now: NOW });
    expect(result.scanned).toBe(6);
    expect(result.deleted.sort()).toEqual(["deletedRoom/x-main-fff.jpg", "roomA/gone-main-ccc.jpg"]);
    expect(removed.sort()).toEqual(result.deleted.sort());
  });

  it("deletes nothing on a dry run", async () => {
    const { sweepOrphanedImages } = await import("@/lib/imageStore");
    const result = await sweepOrphanedImages([], { minAgeMs: 7 * DAY, now: NOW, dryRun: true });
    expect(result.deleted.length).toBeGreaterThan(0);
    expect(removed).toEqual([]);
  });
});
