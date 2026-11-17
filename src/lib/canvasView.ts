/** Zoom/pan on top of "fit the wall in the window". zoom 1 = fit. */
export type CanvasView = { zoom: number; panX: number; panY: number };
export const FIT_VIEW: CanvasView = { zoom: 1, panX: 0, panY: 0 };
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

export function isFitView(v: CanvasView): boolean {
  return v.zoom === 1 && v.panX === 0 && v.panY === 0;
}
