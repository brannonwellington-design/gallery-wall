import type { Unit } from "./types";

const MM_PER_IN = 25.4;
const MM_PER_CM = 10;

export function toMm(value: number, unit: Unit): number {
  return unit === "in" ? value * MM_PER_IN : value * MM_PER_CM;
}

export function fromMm(mm: number, unit: Unit): number {
  return unit === "in" ? mm / MM_PER_IN : mm / MM_PER_CM;
}

/** A length as a form-field string in the given unit, without trailing zeros. */
export function toInput(mm: number, unit: Unit, digits = 2): string {
  return String(Number(fromMm(mm, unit).toFixed(digits)));
}

export function formatLength(mm: number, unit: Unit, digits = 1): string {
  const v = fromMm(mm, unit);
  return `${v.toFixed(digits)}${unit === "in" ? '"' : " cm"}`;
}

/**
 * A length the way you'd read it off a tape measure: inches to the nearest
 * 1/8" as a mixed fraction (57 3/8"), centimetres to one decimal.
 */
export function formatTape(mm: number, unit: Unit): string {
  if (unit === "cm") return `${(mm / MM_PER_CM).toFixed(1)} cm`;
  const eighths = Math.round((mm / MM_PER_IN) * 8);
  const sign = eighths < 0 ? "-" : "";
  const abs = Math.abs(eighths);
  const whole = Math.floor(abs / 8);
  let num = abs % 8;
  let den = 8;
  while (num > 0 && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  const frac = num ? `${num}/${den}` : "";
  if (!whole && frac) return `${sign}${frac}"`;
  return `${sign}${whole}${frac ? ` ${frac}` : ""}"`;
}
