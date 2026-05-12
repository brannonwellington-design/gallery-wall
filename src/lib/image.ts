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
        // come out with black fill. (We don't have transparent images yet
        // but background-removal is on the punch list.)
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
