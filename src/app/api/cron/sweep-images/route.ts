import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepOrphanedImages } from "@/lib/imageStore";
import { getRepo } from "@/lib/repo";
import { errorMessage, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily (vercel.json): delete stored piece images no room uses anymore,
 * after a 7-day grace period. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`; without that env var set the endpoint refuses to run.
 * Add `?dryRun=1` to list what would be deleted.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return jsonError("CRON_SECRET is not configured", 503);
  if (!authorized(req)) return jsonError("Unauthorized", 401);
  try {
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const rooms = (await getRepo().allRooms()).map((r) => r.room);
    const result = await sweepOrphanedImages(rooms, { minAgeMs: GRACE_MS, dryRun });
    console.log("[cron] sweep-images", { dryRun, scanned: result.scanned, deleted: result.deleted.length });
    return NextResponse.json({ dryRun, scanned: result.scanned, deleted: result.deleted });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}
