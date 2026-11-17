import { z } from "zod";
import type { Room } from "./types";

// Server-side shape check for rooms coming in over the API. Deliberately
// tolerant of anything the editor can legitimately produce (zero-size mats,
// pieces dragged partly off the wall) while rejecting junk: non-finite
// numbers, unknown units, absurd sizes, or images that aren't data/https.
// Unknown keys are stripped.

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// Generous ceiling (1 km) — only there to stop nonsense values.
const MAX_MM = 1_000_000;

const length = z.number().finite().min(0).max(MAX_MM);
const coord = z.number().finite().min(-MAX_MM).max(MAX_MM);
const imageSrc = z
  .string()
  .max(12_000_000)
  .refine((s) => s.startsWith("data:image/") || s.startsWith("https://") || s.startsWith("http://"), {
    message: "Image must be a data:image or http(s) URL",
  });

const FrameSchema = z.object({
  matWidth: length,
  frameWidth: length,
  frameColor: z.string().max(64),
});

const ItemSchema = z.object({
  id: z.string().regex(ID),
  name: z.string().max(500),
  imageDataUrl: imageSrc,
  imageOriginalDataUrl: imageSrc.nullable().optional(),
  artWidth: length,
  artHeight: length,
  artWidthOriginal: length.nullable().optional(),
  artHeightOriginal: length.nullable().optional(),
  frame: FrameSchema.nullable(),
  x: coord,
  y: coord,
  pinned: z.boolean().optional(),
});

export const RoomSchema = z.object({
  name: z.string().max(500),
  wallWidth: length.positive(),
  wallHeight: length.positive(),
  unit: z.enum(["in", "cm"]),
  items: z.array(ItemSchema).max(500),
  eyeLineHeight: length.nullable().optional().transform((v) => v ?? undefined),
  eyeLineEnabled: z.boolean().nullable().optional().transform((v) => v ?? undefined),
});

export function parseRoom(input: unknown): { ok: true; room: Room } | { ok: false; error: string } {
  const result = RoomSchema.safeParse(input);
  if (result.success) return { ok: true, room: result.data };
  const issue = result.error.issues[0];
  const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return { ok: false, error: `Invalid room${where}: ${issue?.message ?? "bad shape"}` };
}

/** IDs the app generates: Supabase UUIDs, file-repo base64url, item ids. */
export function isSafeId(id: unknown): id is string {
  return typeof id === "string" && ID.test(id);
}
