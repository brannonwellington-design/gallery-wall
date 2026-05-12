// Client-side image utilities. Uses canvas/Image — must run in the browser.

type DownscaleOptions = {
  maxDim?: number;
  quality?: number;
};

// Resize a data URL so its longest edge is at most `maxDim`, then re-encode
// as JPEG. Returns the original data URL untouched if it's already small.
//
// We do this on every image we store in a room because:
//   - Rooms are PATCHed back to the server as one JSON blob (with all
//     image data URLs inline). Vercel's serverless body limit is 4.5 MB
//     on Hobby — a few raw screenshots blow past that.
//   - Vision extraction is billed per image token. A 1024 px screenshot
//     is plenty for Claude to read product specs, and ~half the cost of
//     full-res.
export async function downscaleImage(
  dataUrl: string,
  { maxDim = 1024, quality = 0.85 }: DownscaleOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = img;
        const longest = Math.max(width, height);
        const scale = longest > maxDim ? maxDim / longest : 1;
        const targetW = Math.round(width * scale);
        const targetH = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't get a 2D canvas context"));
          return;
        }
        // White background under the JPEG so PNGs with transparency don't
        // come out with black fill. (Background-removed images take a
        // different path — see cropToOpaqueBounds.)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error("Couldn't load the image"));
    img.src = dataUrl;
  });
}

export type CropResult = {
  dataUrl: string;
  // cropped-pixel-size / original-pixel-size. The caller scales the
  // piece's physical artWidth/artHeight by these so the visible art
  // keeps its on-wall size and frame/matte hug it.
  widthRatio: number;
  heightRatio: number;
};

// Crop a PNG data URL to the bounding box of its non-transparent pixels.
// Returns null when the image is already tight (margins ≤ tolerance on
// every side) or fully transparent.
//
// Used after background removal: the Replicate model returns the art on a
// transparent canvas at the original frame size, so a 16×20 piece with
// studio padding stays a 16×20 box around just the visible art. Without
// this crop, mat/frame would sit around the original padded box.
export async function cropToOpaqueBounds(
  dataUrl: string,
  options: { alphaThreshold?: number; tolerance?: number } = {},
): Promise<CropResult | null> {
  const { alphaThreshold = 32, tolerance = 1 } = options;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't get a 2D canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);

        // Walk in from each edge to find the first opaque pixel. Faster
        // than a full per-pixel scan when most of the padding is empty.
        let top = -1;
        outer_top: for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            if (data[row + x * 4 + 3] > alphaThreshold) {
              top = y;
              break outer_top;
            }
          }
        }
        if (top < 0) {
          // Fully transparent — nothing to crop to.
          resolve(null);
          return;
        }
        let bottom = h - 1;
        outer_bot: for (let y = h - 1; y >= top; y--) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            if (data[row + x * 4 + 3] > alphaThreshold) {
              bottom = y;
              break outer_bot;
            }
          }
        }
        let left = w - 1;
        outer_left: for (let x = 0; x < w; x++) {
          for (let y = top; y <= bottom; y++) {
            if (data[(y * w + x) * 4 + 3] > alphaThreshold) {
              left = x;
              break outer_left;
            }
          }
        }
        let right = 0;
        outer_right: for (let x = w - 1; x >= left; x--) {
          for (let y = top; y <= bottom; y++) {
            if (data[(y * w + x) * 4 + 3] > alphaThreshold) {
              right = x;
              break outer_right;
            }
          }
        }

        const marginTop = top;
        const marginBottom = h - 1 - bottom;
        const marginLeft = left;
        const marginRight = w - 1 - right;
        if (
          marginTop <= tolerance &&
          marginBottom <= tolerance &&
          marginLeft <= tolerance &&
          marginRight <= tolerance
        ) {
          resolve(null);
          return;
        }

        const cropW = right - left + 1;
        const cropH = bottom - top + 1;
        const out = document.createElement("canvas");
        out.width = cropW;
        out.height = cropH;
        const outCtx = out.getContext("2d");
        if (!outCtx) {
          reject(new Error("Couldn't get a 2D canvas context"));
          return;
        }
        outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
        resolve({
          dataUrl: out.toDataURL("image/png"),
          widthRatio: cropW / w,
          heightRatio: cropH / h,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error("Couldn't load the image"));
    img.src = dataUrl;
  });
}
