import { NextResponse } from "next/server";
import { extractFromImage, extractFromUrl } from "@/lib/extract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { url?: string; imageDataUrl?: string };
  try {
    body = (await req.json()) as { url?: string; imageDataUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY not configured. Add it to .env.local (and Vercel project env).",
      },
      { status: 500 },
    );
  }
  try {
    if (typeof body.imageDataUrl === "string" && body.imageDataUrl) {
      const result = await extractFromImage(body.imageDataUrl);
      return NextResponse.json(result);
    }
    if (typeof body.url === "string" && body.url.trim()) {
      const result = await extractFromUrl(body.url.trim());
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "Provide a url or an imageDataUrl." },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
