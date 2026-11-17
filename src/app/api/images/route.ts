import { NextResponse } from "next/server";
import { ImageUploadError, uploadImage } from "@/lib/imageStore";
import { getRepo } from "@/lib/repo";
import { isSafeId } from "@/lib/roomSchema";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload a single data-URL image to Storage. Used by the client when a
 * room PATCH would exceed Vercel's body limit — images go up one at a
 * time, then the lean room JSON is saved.
 */
export async function POST(req: Request) {
  const body = await readJson<{
    roomId?: unknown;
    itemId?: unknown;
    kind?: unknown;
    dataUrl?: unknown;
  }>(req);
  if (
    !body ||
    !isSafeId(body.roomId) ||
    !isSafeId(body.itemId) ||
    typeof body.dataUrl !== "string" ||
    (body.kind !== "main" && body.kind !== "original")
  ) {
    return jsonError("Invalid body", 400);
  }
  try {
    // Only rooms that exist get a storage folder.
    if (!(await getRepo().exists(body.roomId))) {
      return jsonError("Room not found", 404);
    }
    const url = await uploadImage(body.roomId, body.itemId, body.kind, body.dataUrl);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof ImageUploadError) return jsonError(e.message, e.status);
    return jsonError(errorMessage(e), 500);
  }
}
