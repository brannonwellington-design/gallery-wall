import { describe, expect, it } from "vitest";
import { normalizeRoom, withLegacyImageFields } from "@/lib/roomMigrations";
import { isSafeId, parseRoom } from "@/lib/roomSchema";
import { item, room } from "./helpers";

describe("parseRoom", () => {
  it("accepts a normal room", () => {
    const r = parseRoom(room({ items: [item()] }));
    expect(r.ok).toBe(true);
  });

  it("rejects non-finite and negative sizes", () => {
    expect(parseRoom(room({ wallWidth: Number.NaN })).ok).toBe(false);
    expect(parseRoom(room({ items: [item({ artWidth: -1 })] })).ok).toBe(false);
  });

  it("rejects script and non-image URLs", () => {
    expect(parseRoom(room({ items: [item({ imageSrc: "javascript:alert(1)" })] })).ok).toBe(false);
  });

  it("strips unknown fields", () => {
    const r = parseRoom({ ...room(), extra: "nope" });
    expect(r.ok && "extra" in r.room).toBe(false);
  });

  it("upgrades pre-rename image fields", () => {
    const legacy = { ...room(), items: [{ ...item(), imageSrc: undefined, imageDataUrl: "data:image/png;base64,AA==" }] };
    const r = parseRoom(legacy);
    expect(r.ok && r.room.items[0].imageSrc).toBe("data:image/png;base64,AA==");
  });
});

describe("room migrations", () => {
  it("is a no-op for current rooms", () => {
    const r = room({ items: [item({ imageOriginalSrc: null })] });
    expect(normalizeRoom(r)).toEqual(r);
  });

  it("adds legacy names for pre-rename tabs", () => {
    const out = withLegacyImageFields(room({ items: [item()] }));
    expect((out.items[0] as unknown as { imageDataUrl: string }).imageDataUrl).toBe(out.items[0].imageSrc);
  });
});

describe("isSafeId", () => {
  it("allows uuids and short ids, rejects paths", () => {
    expect(isSafeId("3d84b872-b791-462a-95f8-5cb70e38ccd4")).toBe(true);
    expect(isSafeId("MR_wTar34Vd3c7Gm2gb8Sw")).toBe(true);
    expect(isSafeId("../x")).toBe(false);
    expect(isSafeId("a/b")).toBe(false);
    expect(isSafeId("")).toBe(false);
  });
});
