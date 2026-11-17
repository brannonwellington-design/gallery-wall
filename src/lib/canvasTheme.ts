"use client";

import { useEffect, useState } from "react";

// Colors for the Konva wall canvas. Konva draws to <canvas>, so it can't use
// CSS classes; values come from the Paper brand tokens instead.
//
// Two groups:
// - WALL_INK: marks drawn ON the wall. The wall is always rendered white
//   (it stands in for a real wall), so these stay the light-theme values in
//   both themes — dark-theme tokens would vanish against white.
// - Chrome (useCanvasChrome): labels and lines drawn on the canvas
//   background around the wall. These follow the active theme.

export const WALL_INK = {
  surface: "#FFFFFF",
  edge: "#B6B4AF", // content-disabled
  ink: "#120F08", // content-primary
  inkMuted: "#6B6861", // content-secondary
  tick: "#B6B4AF", // content-disabled
  brand: "#0021CC", // surface-brand-primary
  brandSoft: "#7A85B8", // content-brand-secondary
  positive: "#14B84B", // surface-positive-primary
  eyeLine: "#E5A119", // surface-complimentary-primary
  redline: "#B82214", // content-negative
  mat: "#FBF9F4", // surface-highlight (light)
  placeholder: "#E2DCCF", // surface-tertiary (light)
} as const;

export type CanvasChrome = {
  /** Floor line, wall dimension labels. */
  label: string;
  /** Eye-line height label. */
  eyeLabel: string;
};

const LIGHT_CHROME: CanvasChrome = { label: "#6B6861", eyeLabel: "#B88114" };

function readChrome(): CanvasChrome {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    label: get("--content-secondary", LIGHT_CHROME.label),
    eyeLabel: get("--content-complimentary", LIGHT_CHROME.eyeLabel),
  };
}

/** Theme-aware colors for canvas chrome; updates when the theme toggles. */
export function useCanvasChrome(): CanvasChrome {
  const [chrome, setChrome] = useState<CanvasChrome>(LIGHT_CHROME);
  useEffect(() => {
    const update = () => setChrome(readChrome());
    update();
    // ThemeToggle flips data-theme on <html>; watch for it.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return chrome;
}
