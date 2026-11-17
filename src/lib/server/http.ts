import "server-only";
import { NextResponse } from "next/server";

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Parse a JSON request body, returning null when it is missing or malformed. */
export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
