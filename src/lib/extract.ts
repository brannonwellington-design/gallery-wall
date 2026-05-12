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

// ---- Public entry points ----

export async function extractFromUrl(rawUrl: string): Promise<ExtractResult> {
  const url = normalizeUrl(rawUrl);

  const html = await fetchPage(url);
  const condensed = condenseHtml(html, url);
  const extracted = await callClaudeText(condensed);

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

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function extractFromImage(
  imageDataUrl: string,
): Promise<ExtractResult> {
  const m = imageDataUrl.match(/^data:(image\/[^;,]+);base64,(.+)$/);
  if (!m) {
    throw new Error("Image must be a base64-encoded data URL.");
  }
  const mediaType = m[1].toLowerCase();
  const base64 = m[2];
  if (!SUPPORTED_IMAGE_TYPES.has(mediaType)) {
    throw new Error(
      `Unsupported image type ${mediaType}. Use PNG, JPEG, GIF, or WebP.`,
    );
  }

  const extracted = await callClaudeVision(mediaType, base64);
  return { url: "[image]", extracted, imageDataUrl: null };
}

// ---- Implementation ----

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "sec-ch-ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "Upgrade-Insecure-Requests": "1",
};

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

const VISION_SYSTEM_PROMPT = `You are an extraction agent for a gallery-wall design tool.
The user dropped an image — typically a screenshot of a product listing
page, sometimes a photo of a product, sometimes a clean product image
with no surrounding context. Extract whatever you can see.

Return JSON exactly matching the provided schema. If a field is unknown,
use null — do not invent values.

Fields:

- "name": the product title visible in the image (in the page header,
  near the price, or as a clear caption).
- "imageUrl": always null (the user already has the image).
- "widthInches" and "heightInches": physical dimensions visible in the
  image (specs section, size selector, label, description).
  - If listed in cm or mm, convert to inches.
  - Width is horizontal, height is vertical. If a single dimension
    or paper size is shown, convert to width × height.
  - If both art-size and framed-size are shown, prefer framed.
  - Round to one decimal place.
- "variants": if the image shows multiple sizes (a dropdown, a list,
  a size selector), capture all of them and set top-level
  widthInches/heightInches to the default or selected one.
- "confidence":
  - "high": explicit width × height clearly visible in the image
  - "medium": dimensions inferred from a label, partially visible,
    or width/height assignment is ambiguous
  - "low": no dimensions visible (common for clean product photos)
- "warnings": short notes for the designer:
  - "Multiple sizes shown — pick one"
  - "Image shows only the product; no dimensions visible — please enter manually"
  - "Width/height assignment based on aspect ratio"
  Only include warnings that need attention; don't pad.`;

type DirectFetchResult =
  | { ok: true; html: string }
  | { ok: false; blocked: boolean; status: number | null; error: string };

async function fetchPage(url: string): Promise<string> {
  const direct = await directFetch(url);
  if (direct.ok) return direct.html;

  // If the direct fetch was blocked AND we have a ScrapingBee key, retry
  // through them. They route through residential proxies and handle TLS
  // fingerprinting, which gets us past Akamai / Cloudflare.
  if (direct.blocked && process.env.SCRAPINGBEE_API_KEY) {
    console.log(
      `[extract] Direct fetch returned ${direct.status}; retrying via ScrapingBee for ${url}`,
    );
    return await scrapingBeeFetch(url, process.env.SCRAPINGBEE_API_KEY);
  }

  if (direct.blocked) {
    throw new Error(
      `This site is blocking automated requests (HTTP ${direct.status}). Screenshot the page in your browser and drop the screenshot into the form instead, or set SCRAPINGBEE_API_KEY to enable a fallback.`,
    );
  }
  throw new Error(direct.error);
}

async function directFetch(url: string): Promise<DirectFetchResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return {
      ok: false,
      blocked: false,
      status: null,
      error: `Couldn't reach the page (${e instanceof Error ? e.message : "Unknown error"}).`,
    };
  }
  const blockedCodes = new Set([401, 403, 429, 503, 520, 521, 522]);
  if (blockedCodes.has(res.status)) {
    return {
      ok: false,
      blocked: true,
      status: res.status,
      error: `Site blocked (HTTP ${res.status})`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      blocked: false,
      status: res.status,
      error: `Failed to fetch page: ${res.status} ${res.statusText}`,
    };
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    return {
      ok: false,
      blocked: false,
      status: res.status,
      error: `Unexpected content-type: ${contentType}`,
    };
  }
  return { ok: true, html: await res.text() };
}

async function scrapingBeeFetch(url: string, apiKey: string): Promise<string> {
  const apiUrl = new URL("https://app.scrapingbee.com/api/v1/");
  apiUrl.searchParams.set("api_key", apiKey);
  apiUrl.searchParams.set("url", url);
  // Product pages we care about (West Elm, PB, CB2, Etsy) render their
  // structured data into the HTML on the server. JS rendering costs ~5x
  // more credits and isn't usually needed.
  apiUrl.searchParams.set("render_js", "false");
  // Premium proxy routes through residential IPs — necessary to clear
  // Akamai Bot Manager. Costs 10 credits per request vs 1.
  apiUrl.searchParams.set("premium_proxy", "true");

  let res: Response;
  try {
    res = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    throw new Error(
      `ScrapingBee request failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    );
  }
  if (res.status === 401) {
    throw new Error(
      "ScrapingBee says the API key is invalid. Double-check SCRAPINGBEE_API_KEY.",
    );
  }
  if (res.status === 402) {
    throw new Error(
      "ScrapingBee account is out of credits. Top up at scrapingbee.com, or screenshot the page and drop it into the form.",
    );
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ScrapingBee returned ${res.status}: ${errText.slice(0, 200) || res.statusText}`,
    );
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

async function callClaudeText(condensed: string): Promise<ExtractedProduct> {
  const client = makeClient();
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
  return response.parsed_output ?? fallback("Couldn't parse the page — please fill in manually.");
}

async function callClaudeVision(
  mediaType: string,
  base64: string,
): Promise<ExtractedProduct> {
  const client = makeClient();
  const response = await client.messages.parse({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ExtractedProductSchema),
    },
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: "Extract product info from this image." },
        ],
      },
    ],
  });
  return response.parsed_output ?? fallback("Couldn't read the image — please fill in manually.");
}

function makeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function fallback(warning: string): ExtractedProduct {
  return {
    name: null,
    imageUrl: null,
    widthInches: null,
    heightInches: null,
    variants: [],
    confidence: "low",
    warnings: [warning],
  };
}

async function downloadImage(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
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
