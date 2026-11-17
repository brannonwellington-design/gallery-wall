// Shape of what product extraction returns. Shared by the server (which
// asks Claude to fill it) and the add-piece form (which reads it), so the
// two can't drift apart. Client-safe: no server imports.

import { z } from "zod";

export const VariantSchema = z.object({
  widthInches: z.number(),
  heightInches: z.number(),
  label: z.string().nullable(),
});

export const ExtractedProductSchema = z.object({
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

export type Variant = z.infer<typeof VariantSchema>;

/** The extraction fields the add-piece form uses. */
export type ExtractedFields = Omit<ExtractedProduct, "imageUrl">;
