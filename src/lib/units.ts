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
