import { describe, expect, it } from "vitest";
import { formatLength, toInput, toMm } from "@/lib/units";

describe("units", () => {
  it("round-trips inches and centimetres", () => {
    expect(toMm(1, "in")).toBe(25.4);
    expect(toInput(toMm(2, "in"), "in")).toBe("2");
    expect(toInput(toMm(2, "in"), "cm")).toBe("5.08");
  });

  it("formats lengths with their unit", () => {
    expect(formatLength(toMm(57, "in"), "in")).toBe('57.0"');
    expect(formatLength(500, "cm")).toBe("50.0 cm");
  });
});
