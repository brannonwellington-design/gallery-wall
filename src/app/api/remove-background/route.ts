import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 851-labs/background-remover — pinned to a known-good version.
// Cheap (~$0.001 per image), fast (~5–8s), handles product photography
// and screenshots well.
const MODEL_VERSION =
  "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

export async function POST(req: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      {
        error:
          "REPLICATE_API_TOKEN not configured. Add it to .env.local (and Vercel project env).",
      },
      { status: 500 },
    );
  }
  let body: { imageDataUrl?: string };
  try {
    body = (await req.json()) as { imageDataUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.imageDataUrl) {
    return NextResponse.json(
      { error: "imageDataUrl required" },
      { status: 400 },
    );
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
        input: {
          image: body.imageDataUrl,
          format: "png",
          // Default settings — model handles the rest.
        },
      }),
      signal: AbortSignal.timeout(75000),
    });
    if (!predRes.ok) {
      const errText = await predRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Replicate returned ${predRes.status}: ${errText.slice(0, 240) || predRes.statusText}`,
        },
        { status: 500 },
      );
    }
    const prediction = (await predRes.json()) as {
      status: string;
      output?: unknown;
      error?: string | null;
    };
    if (prediction.error) {
      return NextResponse.json(
        { error: prediction.error },
        { status: 500 },
      );
    }
    if (prediction.status !== "succeeded") {
      return NextResponse.json(
        {
          error: `Replicate prediction status: ${prediction.status} (try again).`,
        },
        { status: 504 },
      );
    }

    const url =
      typeof prediction.output === "string"
        ? prediction.output
        : Array.isArray(prediction.output)
          ? String(prediction.output[0])
          : null;
    if (!url) {
      return NextResponse.json(
        { error: "No image URL in Replicate response." },
        { status: 500 },
      );
    }

    const imgRes = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Couldn't fetch result image: ${imgRes.status}` },
        { status: 500 },
      );
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return NextResponse.json({ imageDataUrl: dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
