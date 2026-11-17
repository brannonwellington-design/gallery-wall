"use client";

import { useCallback, useState } from "react";
import { cropToOpaqueBounds, downscaleTransparentImage } from "@/lib/image";
import type { Item, Room } from "@/lib/types";
import type { UseHistoryReturn } from "@/lib/useHistory";

type SetRoom = UseHistoryReturn<Room>["setState"];

/**
 * Remove a piece's background via /api/remove-background, crop the
 * transparent padding, and keep the original so it can be restored.
 * Toggling again restores the original without a network call.
 */
export function useBackgroundRemoval(items: Item[], setRoom: SetRoom) {
  const [bgBusyId, setBgBusyId] = useState<string | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

  const toggleBackground = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      // If the original is stashed, restore it (and the pre-crop dims, if
      // we shrank them) without a network call.
      if (item.imageOriginalSrc) {
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  imageSrc: it.imageOriginalSrc!,
                  imageOriginalSrc: null,
                  artWidth: it.artWidthOriginal ?? it.artWidth,
                  artHeight: it.artHeightOriginal ?? it.artHeight,
                  artWidthOriginal: null,
                  artHeightOriginal: null,
                }
              : it,
          ),
        }));
        return;
      }

      setBgBusyId(id);
      setBgError(null);
      try {
        const res = await fetch("/api/remove-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: item.imageSrc }),
        });
        const data = (await res.json()) as {
          imageDataUrl?: string;
          error?: string;
        };
        if (!res.ok || !data.imageDataUrl) {
          throw new Error(data.error || `Failed (${res.status})`);
        }
        // Auto-crop transparent padding so frame/matte hug the actual art,
        // and shrink physical dims by the same ratio to preserve on-wall
        // size. If the result is already tight, crop returns null and we
        // keep dims unchanged.
        let finalImage = data.imageDataUrl;
        let widthRatio = 1;
        let heightRatio = 1;
        try {
          const cropped = await cropToOpaqueBounds(data.imageDataUrl);
          if (cropped) {
            finalImage = cropped.dataUrl;
            widthRatio = cropped.widthRatio;
            heightRatio = cropped.heightRatio;
          }
        } catch {
          // Crop failures shouldn't block the bg-removal result.
        }
        // Cap PNG size so rooms stay under the PATCH body limit.
        try {
          finalImage = await downscaleTransparentImage(finalImage);
        } catch {
          // Keep the full PNG if downscale fails.
        }
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) => {
            if (it.id !== id) return it;
            const cropped = widthRatio < 1 || heightRatio < 1;
            return {
              ...it,
              imageOriginalSrc: it.imageSrc,
              imageSrc: finalImage,
              ...(cropped
                ? {
                    artWidthOriginal: it.artWidth,
                    artHeightOriginal: it.artHeight,
                    artWidth: it.artWidth * widthRatio,
                    artHeight: it.artHeight * heightRatio,
                  }
                : {}),
            };
          }),
        }));
      } catch (e) {
        setBgError(
          `Couldn’t remove the background for “${item.name || "Untitled"}”: ${
            e instanceof Error ? e.message : "Unknown error"
          }`,
        );
      } finally {
        setBgBusyId(null);
      }
    },
    [items, setRoom],
  );

  const dismissBgError = useCallback(() => setBgError(null), []);

  return { bgBusyId, bgError, dismissBgError, toggleBackground };
}
