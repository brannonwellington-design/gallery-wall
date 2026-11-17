import { describe, expect, it } from "vitest";
import { eyeLine, framePadding, outerRect, outerSize } from "@/lib/geometry";
import { item, room } from "./helpers";

describe("frame geometry", () => {
  it("adds mat and frame on both sides", () => {
    const framed = item({ frame: { matWidth: 50, frameWidth: 20, frameColor: "#000" } });
    expect(framePadding(framed)).toBe(70);
    expect(outerSize(framed)).toEqual({ width: 540, height: 440 });
  });

  it("is just the art when unframed", () => {
    expect(outerRect(item({ x: 10, y: 20 }))).toEqual({ x: 10, y: 20, width: 400, height: 300 });
  });
});

describe("eyeLine", () => {
  it("converts height-from-floor to distance from the top", () => {
    expect(eyeLine(room({ eyeLineHeight: 1448 }))).toEqual({
      y: 2400 - 1448,
      heightFromFloor: 1448,
      clamped: false,
    });
  });

  it("clamps onto short walls", () => {
    expect(eyeLine(room({ wallHeight: 1000, eyeLineHeight: 1448 }))).toMatchObject({
      y: 0,
      clamped: true,
    });
  });

  it("is null when disabled", () => {
    expect(eyeLine(room({ eyeLineEnabled: false }))).toBeNull();
  });

  it("defaults to the 57 inch museum standard", () => {
    expect(eyeLine(room())?.heightFromFloor).toBeCloseTo(57 * 25.4);
  });
});
