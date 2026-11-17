import { NextResponse } from "next/server";
import { extractFromImage, extractFromUrl } from "@/lib/extract";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";
import { UnsafeUrlError } from "@/lib/server/safeFetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readJson<{ url?: unknown; imageDataUrl?: unknown }>(req);
  if (!body) return jsonError("Invalid JSON body", 400);
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      "ANTHROPIC_API_KEY not configured. Add it to .env.local (and Vercel project env).",
      500,
    );
  }
  try {
    if (typeof body.imageDataUrl === "string" && body.imageDataUrl) {
      return NextResponse.json(await extractFromImage(body.imageDataUrl));
    }
    if (typeof body.url === "string" && body.url.trim()) {
      if (body.url.length > 2048) return jsonError("URL is too long.", 400);
      return NextResponse.json(await extractFromUrl(body.url.trim()));
    }
    return jsonError("Provide a url or an imageDataUrl.", 400);
  } catch (e) {
    return jsonError(errorMessage(e), e instanceof UnsafeUrlError ? 400 : 500);
  }
}
