import { describe, expect, it } from "vitest";
import { buildRoomPreview } from "@/lib/roomPreview";
import { item, room } from "./helpers";

describe("buildRoomPreview", () => {
  it("keeps the wall, outer boxes and https images", () => {
    const p = buildRoomPreview(
      room({
        items: [item({ x: 10, y: 20, frame: { matWidth: 20, frameWidth: 10, frameColor: "#123456" } })],
        fixtures: [{ id: "s", kind: "sofa", x: 0, y: 1500, width: 2000, height: 900 }],
      }),
    );
    expect(p.wallWidth).toBe(3000);
    expect(p.items[0]).toMatchObject({ x: 10, y: 20, width: 460, height: 360, frameColor: "#123456" });
    expect(p.items[0].image).toMatch(/^https:/);
    expect(p.fixtures[0]).toMatchObject({ kind: "sofa", width: 2000 });
  });

  it("drops inline images so the list stays small", () => {
    const p = buildRoomPreview(room({ items: [item({ imageSrc: "data:image/png;base64," + "A".repeat(10000) })] }));
    expect(p.items[0].image).toBeNull();
    expect(JSON.stringify(p).length).toBeLessThan(500);
  });

  it("reads rooms saved before the image-field rename", () => {
    const legacy = { ...room(), items: [{ ...item(), imageSrc: undefined, imageDataUrl: "https://x.supabase.co/a.jpg" }] };
    expect(buildRoomPreview(legacy as never).items[0].image).toBe("https://x.supabase.co/a.jpg");
  });
});
