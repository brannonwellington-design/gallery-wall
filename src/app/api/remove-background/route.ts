import { NextResponse } from "next/server";
import { base64Bytes, parseImageDataUrl } from "@/lib/dataUrl";
import { errorMessage, jsonError, readJson } from "@/lib/server/http";
import { readCapped, safeFetch } from "@/lib/server/safeFetch";
import { supabaseHost } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 851-labs/background-remover — pinned to a known-good version.
// Cheap (~$0.001 per image), fast (~5–8s), handles product photography
// and screenshots well.
const MODEL_VERSION =
  "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

/**
 * Only send Replicate images the app itself produced: an inline raster
 * data URL, or a URL in this project's own Supabase Storage bucket. Anything
 * else would let callers point Replicate (and our bill) at arbitrary URLs.
 */
function acceptableInput(image: string): boolean {
  if (image.startsWith("data:")) {
    const parsed = parseImageDataUrl(image);
    return !!parsed && base64Bytes(parsed.base64) <= MAX_INPUT_BYTES;
  }
  const host = supabaseHost();
  if (!host) return false;
  try {
    const url = new URL(image);
    return (
      url.protocol === "https:" &&
      url.host === host &&
      url.pathname.startsWith("/storage/v1/object/public/room-images/")
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return jsonError(
      "REPLICATE_API_TOKEN not configured. Add it to .env.local (and Vercel project env).",
      500,
    );
  }
  const body = await readJson<{ imageDataUrl?: unknown }>(req);
  if (!body) return jsonError("Invalid JSON body", 400);
  if (typeof body.imageDataUrl !== "string" || !body.imageDataUrl) {
    return jsonError("imageDataUrl required", 400);
  }
  if (!acceptableInput(body.imageDataUrl)) {
    return jsonError("Unsupported image source.", 400);
  }

  try {
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        // Synchronous mode — wait for completion (up to ~60s) before
        // returning. Good for short-running models like bg removal.
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: { image: body.imageDataUrl, format: "png" },
      }),
      signal: AbortSignal.timeout(75000),
    });
    if (!predRes.ok) {
      const errText = await predRes.text().catch(() => "");
      return jsonError(
        `Replicate returned ${predRes.status}: ${errText.slice(0, 240) || predRes.statusText}`,
        502,
      );
    }
    const prediction = (await predRes.json()) as {
      status: string;
      output?: unknown;
      error?: string | null;
    };
    if (prediction.error) return jsonError(prediction.error, 502);
    if (prediction.status !== "succeeded") {
      return jsonError(
        `Replicate prediction status: ${prediction.status} (try again).`,
        504,
      );
    }

    const url =
      typeof prediction.output === "string"
        ? prediction.output
        : Array.isArray(prediction.output)
          ? String(prediction.output[0])
          : null;
    if (!url) return jsonError("No image URL in Replicate response.", 502);

    const { res: imgRes } = await safeFetch(url, { timeoutMs: 20000 });
    if (!imgRes.ok) {
      return jsonError(`Couldn't fetch result image: ${imgRes.status}`, 502);
    }
    const buf = await readCapped(imgRes, MAX_OUTPUT_BYTES);
    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${buf.toString("base64")}`,
    });
  } catch (e) {
    return jsonError(errorMessage(e), 500);
  }
}
