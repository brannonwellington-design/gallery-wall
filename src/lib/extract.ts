import "server-only";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// ---- Schema ----

const VariantSchema = z.object({
  widthInches: z.number(),
  heightInches: z.number(),
  label: z.string().nullable(),
});

const ExtractedProductSchema = z.object({
  name: z.string().nullable(),
  imageUrl: z.string().nullable(),
  widthInches: z.number().nullable(),
  heightInches: z.number().nullable(),
  variants: z.array(VariantSchema),
  confidence: z.enum(["high", "medium", "low"]),
  warnings: z.array(z.string()),
});

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;

export type ExtractResult = {
  url: string;
  extracted: ExtractedProduct;
  imageDataUrl: string | null;
};

// ---- Public entry point ----

export async function extractFromUrl(rawUrl: string): Promise<ExtractResult> {
  const url = normalizeUrl(rawUrl);

  const html = await fetchPage(url);
  const condensed = condenseHtml(html, url);
  const extracted = await callClaude(condensed);

  let imageDataUrl: string | null = null;
  if (extracted.imageUrl) {
    try {
      imageDataUrl = await downloadImage(extracted.imageUrl);
    } catch {
      // Leave imageDataUrl null; the form lets the user upload manually.
    }
  }

  return { url, extracted, imageDataUrl };
}

// ---- Implementation ----

const USER_AGENT =
  "Mozilla/5.0 (compatible; gallery-wall/1.0; +https://github.com/brannonwellington-design/gallery-wall)";

const SYSTEM_PROMPT = `You are an extraction agent for a gallery-wall design tool.
Given the condensed content of a product listing page, extract the
information a designer needs to place this piece on a wall to scale.

Return JSON exactly matching the provided schema. If a field is unknown,
use null — do not invent values.

Fields:

- "name": the product title. Use the concise, human-readable title — strip
  SEO bloat like "| EtsyStore | Free Shipping | 12x18 18x24 24x36".
- "imageUrl": the URL of the primary product photo. Prefer images of the
  artwork on a plain background. Avoid lifestyle photos (the same art shown
  hanging in a styled room) when an isolated product shot is available.
  Must be an absolute URL.
- "widthInches" and "heightInches": physical dimensions in inches.
  - Width is the horizontal dimension; height is vertical. If the listing
    only specifies a single number (e.g. "18 inch print") or a paper size
    (e.g. "A2"), convert to width × height using standard sizes.
  - If listed in cm or mm, convert to inches.
  - If both art-size and framed-size are given, prefer the framed exterior.
  - Round to one decimal place.
- "variants": if the listing offers multiple sizes (variant dropdown, size
  options in description), list all of them. Set "widthInches" and
  "heightInches" at the top level to the default / first variant.
  If only one size is offered, leave "variants" as an empty array.
- "confidence":
  - "high": explicit width × height in inches or cm, unambiguously
    representing the outer size the designer would hang.
  - "medium": dimensions inferred from a label or variant dropdown, or
    width/height assignment is ambiguous.
  - "low": dimensions absent, in image alt text only, or only approximate.
- "warnings": short notes for the designer to review. Examples:
  - "Listing has multiple sizes — pick one"
  - "Frame vs art dimensions ambiguous — using art size"
  - "Width/height assignment based on image aspect ratio"
  - "No dimensions found in listing"
  Only include warnings that genuinely need attention; don't pad.`;

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }
  return await res.text();
}

function condenseHtml(html: string, sourceUrl: string): string {
  const $ = cheerio.load(html);

  $('script:not([type="application/ld+json"])').remove();
  $("style, noscript, link, iframe").remove();

  const lines: string[] = [];
  lines.push(`URL: ${sourceUrl}`);
  const title = $("title").first().text().trim();
  if (title) lines.push(`TITLE: ${title}`);
  lines.push("");

  // Relevant meta tags
  lines.push("META:");
  const keepMeta = (name: string) =>
    name.startsWith("og:") ||
    name.startsWith("product:") ||
    name.startsWith("twitter:") ||
    name === "description" ||
    name === "keywords";
  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property") || "";
    const content = $(el).attr("content") || "";
    if (keepMeta(name) && content) {
      lines.push(`  ${name}: ${content.slice(0, 400)}`);
    }
  });
  lines.push("");

  // JSON-LD product schemas
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (text) jsonLd.push(text);
  });
  if (jsonLd.length > 0) {
    lines.push("JSON-LD:");
    for (const blob of jsonLd) {
      lines.push(blob.slice(0, 4000));
    }
    lines.push("");
  }

  // Image candidates
  const imageUrls = new Set<string>();
  const ogImg = $('meta[property="og:image"]').attr("content");
  if (ogImg) imageUrls.add(toAbsolute(ogImg, sourceUrl));
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-zoom-image") ||
      $(el).attr("data-large_image");
    if (src) imageUrls.add(toAbsolute(src, sourceUrl));
  });
  if (imageUrls.size > 0) {
    lines.push("IMAGE CANDIDATES:");
    for (const u of Array.from(imageUrls).slice(0, 25)) {
      lines.push(`  ${u}`);
    }
    lines.push("");
  }

  // Variant / size selectors
  const sizeOptions = new Set<string>();
  $('select option, [class*="size" i] li, [class*="variant" i] li').each(
    (_, el) => {
      const t = $(el).text().trim();
      if (t && t.length < 80) sizeOptions.add(t);
    },
  );
  if (sizeOptions.size > 0) {
    lines.push("SIZE OPTIONS (raw):");
    for (const o of Array.from(sizeOptions).slice(0, 30)) {
      lines.push(`  ${o}`);
    }
    lines.push("");
  }

  // Body text, with chrome stripped
  $("header, nav, footer, aside, form, button").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  lines.push("BODY TEXT (truncated):");
  lines.push(bodyText.slice(0, 14000));

  return lines.join("\n");
}

async function callClaude(condensed: string): Promise<ExtractedProduct> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ExtractedProductSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: condensed }],
  });

  if (!response.parsed_output) {
    return {
      name: null,
      imageUrl: null,
      widthInches: null,
      heightInches: null,
      variants: [],
      confidence: "low",
      warnings: ["Could not parse the page — please fill in manually."],
    };
  }
  return response.parsed_output;
}

async function downloadImage(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 8 * 1024 * 1024) return null; // 8 MB cap
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function toAbsolute(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL must start with http:// or https://");
  }
  return trimmed;
}
