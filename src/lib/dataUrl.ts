// Shared parsing for base64 image data URLs. Only raster formats the app
// can render and the storage bucket accepts are allowed; SVG in particular
// is rejected because it can carry script.

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export type ParsedDataUrl = {
  contentType: AllowedImageType;
  ext: string;
  base64: string;
};

export function parseImageDataUrl(dataUrl: string): ParsedDataUrl | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  if (!(contentType in ALLOWED_IMAGE_TYPES)) return null;
  const type = contentType as AllowedImageType;
  return { contentType: type, ext: ALLOWED_IMAGE_TYPES[type], base64: m[2] };
}

/** Decoded size of a base64 payload, without decoding it. */
export function base64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
