"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type Konva from "konva";
import type { Fixture, Item, Room } from "@/lib/types";
import { constrainFixture, keepOutRect } from "@/lib/fixtures";
import { useCanvasChrome, WALL_INK } from "@/lib/canvasTheme";
import { eyeLine, outerRect } from "@/lib/geometry";
import { formatLength } from "@/lib/units";
import { computeSnap, type Guide, type Rect as SnapRect } from "@/lib/snap";
import { computeSpacingSegments, type SpacingSegment } from "@/lib/spacing";
import { Minus, Plus } from "lucide-react";
import { FIT_VIEW, isFitView, MAX_ZOOM, MIN_ZOOM, type CanvasView } from "@/lib/canvasView";
import FixtureNode from "./FixtureNode";
import ItemNode from "./ItemNode";

type Props = {
  room: Room;
  selectedIds: Set<string>;
  snapEnabled: boolean;
  redlinesEnabled: boolean;
  onSelect: (id: string | null, additive?: boolean) => void;
  /** Commit positions for one or more pieces (a drag of the selection). */
  onMoveItems: (moves: { id: string; x: number; y: number }[]) => void;
  view: CanvasView;
  onViewChange: (view: CanvasView) => void;
  /** Pieces other people have selected, with their color and name. */
  remoteSelections?: Map<string, { color: string; name: string }>;
  selectedFixtureId: string | null;
  onSelectFixture: (id: string) => void;
  onMoveFixture: (id: string, xMm: number, yMm: number) => void;
};

const PADDING = 56;
const SNAP_THRESHOLD_PX = 6;
const REDLINE = WALL_INK.redline;

const itemRect = outerRect;

const WallCanvas = forwardRef<Konva.Stage, Props>(function WallCanvas(
  {
    room,
    selectedIds,
    snapEnabled,
    redlinesEnabled,
    onSelect,
    onMoveItems,
    view,
    onViewChange,
    remoteSelections,
    selectedFixtureId,
    onSelectFixture,
    onMoveFixture,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsLayerRef = useRef<Konva.Layer>(null);
  // While dragging a multi-piece selection: where each piece started (mm).
  const groupDrag = useRef<{ leader: string; starts: Map<string, { x: number; y: number }> } | null>(null);
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const chrome = useCanvasChrome();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const altPressed = useRef(false);
  const guidesRaf = useRef<number | null>(null);
  const pendingDrag = useRef<{
    id: string;
    x: number;
    y: number;
    guides: Guide[];
  } | null>(null);

  const flushDragVisuals = useCallback(() => {
    guidesRaf.current = null;
    const pending = pendingDrag.current;
    if (!pending) return;
    setGuides(pending.guides);
    setDragging({ id: pending.id, x: pending.x, y: pending.y });
  }, []);

  const scheduleDragVisuals = useCallback(
    (id: string, x: number, y: number, nextGuides: Guide[]) => {
      pendingDrag.current = { id, x, y, guides: nextGuides };
      if (guidesRaf.current != null) return;
      guidesRaf.current = requestAnimationFrame(flushDragVisuals);
    },
    [flushDragVisuals],
  );

  useEffect(() => {
    return () => {
      if (guidesRaf.current != null) cancelAnimationFrame(guidesRaf.current);
    };
  }, []);

  // Track Alt key — held = disable snap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      altPressed.current = e.altKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availableW = Math.max(0, size.w - PADDING * 2);
  const availableH = Math.max(0, size.h - PADDING * 2);
  const scaleX = availableW / room.wallWidth;
  const scaleY = availableH / room.wallHeight;
  const fitScale = Math.min(scaleX, scaleY) || 1;
  const scale = fitScale * view.zoom;
  const wallPxW = room.wallWidth * scale;
  const wallPxH = room.wallHeight * scale;
  const offsetX = (size.w - wallPxW) / 2 + view.panX;
  const offsetY = (size.h - wallPxH) / 2 + view.panY;

  // Trackpad pinch / ⌘-scroll zooms around the pointer; plain scroll pans
  // when zoomed in. Native listener so preventDefault stops page zoom.
  const viewRef = useRef({ view, size, fitScale, wall: { w: room.wallWidth, h: room.wallHeight } });
  useEffect(() => {
    viewRef.current = { view, size, fitScale, wall: { w: room.wallWidth, h: room.wallHeight } };
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { view: v, size: sz, fitScale: fs, wall } = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const oldScale = fs * v.zoom;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * Math.exp(-e.deltaY * 0.0025)));
        const newScale = fs * zoom;
        // Keep the wall point under the pointer where it is.
        const wx = (px - ((sz.w - wall.w * oldScale) / 2 + v.panX)) / oldScale;
        const wy = (py - ((sz.h - wall.h * oldScale) / 2 + v.panY)) / oldScale;
        onViewChange({
          zoom,
          panX: px - wx * newScale - (sz.w - wall.w * newScale) / 2,
          panY: py - wy * newScale - (sz.h - wall.h * newScale) / 2,
        });
      } else if (v.zoom > 1) {
        e.preventDefault();
        onViewChange({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onViewChange]);

  function zoomBy(factor: number) {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    // Zoom around the window center.
    const k = zoom / view.zoom;
    onViewChange({ zoom, panX: view.panX * k, panY: view.panY * k });
  }

  const fixtures = room.fixtures ?? [];
  const wallSize = { wallWidth: room.wallWidth, wallHeight: room.wallHeight };

  const fixtureDragBound =
    (fixture: Fixture) => (pos: { x: number; y: number }) => {
      const moved = constrainFixture(
        { ...fixture, x: (pos.x - offsetX) / scale, y: (pos.y - offsetY) / scale },
        wallSize,
      );
      return { x: offsetX + moved.x * scale, y: offsetY + moved.y * scale };
    };

  const eye = eyeLine(room);
  const eyeLineY = eye?.y ?? null;

  // Build a per-item dragBoundFunc that snaps in mm and returns absolute
  // stage coords for Konva to use as the new node position.
  // Recreated each render; it was already called inline per item, so a
  // useCallback here never saved work.
  const makeDragBoundFunc =
    (item: Item) => (pos: { x: number; y: number }) => {
      const layerX = pos.x - offsetX;
      const layerY = pos.y - offsetY;
      const draggedMmX = layerX / scale;
      const draggedMmY = layerY / scale;
      const rect = itemRect(item);
      const dragged: SnapRect = {
        x: draggedMmX,
        y: draggedMmY,
        width: rect.width,
        height: rect.height,
      };
      const movingTogether = groupDrag.current?.starts;
      const others = [
        ...room.items
          .filter((it) => it.id !== item.id && !movingTogether?.has(it.id))
          .map(itemRect),
        // Fixtures: align to their edges and centers. For furniture the
        // keep-out rect's top edge is the "8 in above" line, so a piece's
        // bottom snaps to the recommended hanging height.
        ...fixtures.map(keepOutRect),
      ];
      const result = computeSnap({
        dragged,
        others,
        wall: { width: room.wallWidth, height: room.wallHeight },
        threshold: SNAP_THRESHOLD_PX / scale,
        enabled: snapEnabled && !altPressed.current,
        eyeLineY: eyeLineY ?? undefined,
      });
      // Update guide state for rendering — rAF-throttled so every
      // pointer sample doesn't force a React re-render.
      scheduleDragVisuals(item.id, result.x, result.y, result.guides);
      return {
        x: offsetX + result.x * scale,
        y: offsetY + result.y * scale,
      };
    };

  // Decide which rect to show measurements for (selected-item mode only).
  const measureItem: { rect: SnapRect } | null = (() => {
    if (redlinesEnabled) return null;
    if (dragging) {
      const it = room.items.find((i) => i.id === dragging.id);
      if (it) {
        const r = itemRect(it);
        return { rect: { ...r, x: dragging.x, y: dragging.y } };
      }
    }
    if (selectedId) {
      const it = room.items.find((i) => i.id === selectedId);
      if (it) return { rect: itemRect(it) };
    }
    return null;
  })();

  const redlineSegments: SpacingSegment[] = (() => {
    if (!redlinesEnabled) return [];
    const named = room.items.map((it) => {
      const r = itemRect(it);
      if (dragging && dragging.id === it.id) {
        return { ...r, x: dragging.x, y: dragging.y, id: it.id };
      }
      return { ...r, id: it.id };
    });
    return computeSpacingSegments(named, {
      width: room.wallWidth,
      height: room.wallHeight,
    });
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-surface-secondary overflow-hidden"
    >
      {size.w > 0 && size.h > 0 && (
        <Stage
          ref={ref}
          width={size.w}
          height={size.h}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage() && !e.evt.shiftKey) onSelect(null);
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
        >
          {/* Wall surface — kept literal white because it represents an actual wall */}
          <Layer>
            <Rect
              x={offsetX}
              y={offsetY}
              width={wallPxW}
              height={wallPxH}
              fill={WALL_INK.surface}
              stroke={WALL_INK.edge}
              strokeWidth={1}
            />
          </Layer>

          {/* Fixtures sit on the wall, under the art. */}
          <Layer x={offsetX} y={offsetY}>
            {fixtures.map((f) => (
              <FixtureNode
                key={f.id}
                fixture={f}
                scale={scale}
                selected={f.id === selectedFixtureId}
                unitLabel={room.unit === "in" ? "\u2033" : " cm"}
                onSelect={() => onSelectFixture(f.id)}
                onDragEnd={(x, y) => onMoveFixture(f.id, x, y)}
                dragBoundFunc={fixtureDragBound(f)}
              />
            ))}
          </Layer>

          {/* Items (positioned relative to wall origin) */}
          <Layer ref={itemsLayerRef} x={offsetX} y={offsetY}>
            {room.items.map((item) => (
              <ItemNode
                key={item.id}
                item={item}
                scale={scale}
                selected={selectedIds.has(item.id)}
                remote={remoteSelections?.get(item.id)}
                onSelect={(additive) => onSelect(item.id, additive)}
                onDragStart={(additive) => {
                  const inSelection = selectedIds.has(item.id);
                  if (!inSelection) onSelect(item.id, additive);
                  // Dragging one of several selected pieces moves them all.
                  const members =
                    inSelection && selectedIds.size > 1
                      ? room.items.filter((it) => selectedIds.has(it.id))
                      : additive && selectedIds.size > 0
                        ? room.items.filter((it) => selectedIds.has(it.id) || it.id === item.id)
                        : [item];
                  groupDrag.current =
                    members.length > 1
                      ? { leader: item.id, starts: new Map(members.map((m) => [m.id, { x: m.x, y: m.y }])) }
                      : null;
                  setDragging({ id: item.id, x: item.x, y: item.y });
                }}
                onDragMove={(x, y) => {
                  const g = groupDrag.current;
                  const layer = itemsLayerRef.current;
                  if (!g || !layer) return;
                  const start = g.starts.get(g.leader)!;
                  const dx = x - start.x;
                  const dy = y - start.y;
                  for (const [id, s] of g.starts) {
                    if (id === g.leader) continue;
                    layer.findOne(`#item-${id}`)?.position({ x: (s.x + dx) * scale, y: (s.y + dy) * scale });
                  }
                }}
                onDragEnd={(x, y) => {
                  if (guidesRaf.current != null) {
                    cancelAnimationFrame(guidesRaf.current);
                    guidesRaf.current = null;
                  }
                  pendingDrag.current = null;
                  setDragging(null);
                  setGuides([]);
                  const g = groupDrag.current;
                  groupDrag.current = null;
                  if (g) {
                    const start = g.starts.get(g.leader)!;
                    const dx = x - start.x;
                    const dy = y - start.y;
                    onMoveItems([...g.starts].map(([id, s]) => ({ id, x: s.x + dx, y: s.y + dy })));
                  } else {
                    onMoveItems([{ id: item.id, x, y }]);
                  }
                }}
                dragBoundFunc={makeDragBoundFunc(item)}
              />
            ))}
          </Layer>

          {/* Eye line above art so the toggle is always obvious */}
          {eye && eyeLineY != null && (
            <Layer listening={false}>
              <Line
                points={[
                  offsetX,
                  offsetY + eyeLineY * scale,
                  offsetX + wallPxW,
                  offsetY + eyeLineY * scale,
                ]}
                stroke={WALL_INK.eyeLine}
                strokeWidth={2}
                dash={[8, 5]}
                opacity={0.95}
              />
              <Text
                text={
                  eye.clamped
                    ? `eye ${formatLength(eye.heightFromFloor, room.unit, 1)} (clamped to wall)`
                    : `eye ${formatLength(eye.heightFromFloor, room.unit, 1)}`
                }
                x={offsetX + wallPxW + 6}
                y={offsetY + eyeLineY * scale - 7}
                fontSize={12}
                fontFamily="Inter, sans-serif"
                fill={chrome.eyeLabel}
              />
            </Layer>
          )}

          {/* Guides + measurements (top, non-interactive) */}
          <Layer x={offsetX} y={offsetY} listening={false}>
            <GuideLines guides={guides} scale={scale} />
            {measureItem && (
              <Measurements
                rect={measureItem.rect}
                wall={{ width: room.wallWidth, height: room.wallHeight }}
                unit={room.unit}
                scale={scale}
              />
            )}
            {redlinesEnabled && (
              <Redlines
                segments={redlineSegments}
                unit={room.unit}
                scale={scale}
              />
            )}
          </Layer>

          {/* Floor line + wall labels (top, non-interactive, in stage coords) */}
          <Layer listening={false}>
            <Line
              points={[
                offsetX - 24,
                offsetY + wallPxH,
                offsetX + wallPxW + 24,
                offsetY + wallPxH,
              ]}
              stroke={chrome.label}
              strokeWidth={1}
            />
            <Text
              text="Floor"
              x={offsetX + wallPxW + 28}
              y={offsetY + wallPxH - 6}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill={chrome.label}
            />
            <Text
              text={formatLength(room.wallWidth, room.unit, 1)}
              x={offsetX + wallPxW / 2 - 30}
              y={offsetY - 20}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill={chrome.label}
            />
            <Text
              text={formatLength(room.wallHeight, room.unit, 1)}
              x={offsetX - 44}
              y={offsetY + wallPxH / 2 - 6}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill={chrome.label}
            />
          </Layer>
        </Stage>
      )}
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-surface-tertiary bg-surface-primary p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          disabled={view.zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          className="flex size-7 items-center justify-center rounded-md text-content-primary hover:bg-surface-secondary disabled:text-content-disabled"
        >
          <Minus size={14} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange(FIT_VIEW)}
          aria-label="Fit wall to window"
          title="Fit wall to window"
          className="h-7 min-w-12 rounded-md px-1.5 text-label text-content-secondary tabular hover:bg-surface-secondary"
        >
          {isFitView(view) ? "Fit" : `${Math.round(view.zoom * 100)}%`}
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          disabled={view.zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          className="flex size-7 items-center justify-center rounded-md text-content-primary hover:bg-surface-secondary disabled:text-content-disabled"
        >
          <Plus size={14} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

export default WallCanvas;

function guideColor(reason: Guide["reason"]): string {
  // Brand-aware semantic guide palette.
  switch (reason) {
    case "wall-edge":
    case "item-edge":
      return WALL_INK.brand;
    case "wall-center":
    case "item-center":
      return WALL_INK.brandSoft;
    case "equal-spacing":
      return WALL_INK.positive;
    case "eye-line":
      return WALL_INK.eyeLine;
  }
}

function GuideLines({ guides, scale }: { guides: Guide[]; scale: number }) {
  return (
    <>
      {guides.map((g, i) => {
        const color = guideColor(g.reason);
        const dash = g.reason === "equal-spacing" ? [6, 4] : undefined;
        if (g.kind === "v") {
          return (
            <Line
              key={i}
              points={[g.at * scale, g.y0 * scale, g.at * scale, g.y1 * scale]}
              stroke={color}
              strokeWidth={1}
              dash={dash}
            />
          );
        }
        return (
          <Line
            key={i}
            points={[g.x0 * scale, g.at * scale, g.x1 * scale, g.at * scale]}
            stroke={color}
            strokeWidth={1}
            dash={dash}
          />
        );
      })}
    </>
  );
}

function Measurements({
  rect,
  wall,
  unit,
  scale,
}: {
  rect: SnapRect;
  wall: { width: number; height: number };
  unit: "in" | "cm";
  scale: number;
}) {
  const left = rect.x;
  const right = wall.width - (rect.x + rect.width);
  const top = rect.y;
  const bottom = wall.height - (rect.y + rect.height);
  const centerY = rect.y + rect.height / 2;
  const centerToFloor = wall.height - centerY;

  const labelStyle = {
    fontSize: 10,
    fill: WALL_INK.ink,
    padding: 2,
  } as const;

  // px helpers
  const pxX = rect.x * scale;
  const pxY = rect.y * scale;
  const pxW = rect.width * scale;
  const pxH = rect.height * scale;
  const pxRight = (rect.x + rect.width) * scale;
  const pxBottom = (rect.y + rect.height) * scale;

  // Tick line color
  const tick = WALL_INK.tick;
  const tickW = 1;

  return (
    <Group>
      {/* Left distance to wall */}
      <Line
        points={[0, pxY + pxH / 2, pxX, pxY + pxH / 2]}
        stroke={tick}
        strokeWidth={tickW}
        dash={[3, 3]}
      />
      <Label
        text={formatLength(left, unit, 1)}
        x={pxX / 2 - 14}
        y={pxY + pxH / 2 - 16}
        {...labelStyle}
      />

      {/* Right distance to wall */}
      <Line
        points={[
          pxRight,
          pxY + pxH / 2,
          wall.width * scale,
          pxY + pxH / 2,
        ]}
        stroke={tick}
        strokeWidth={tickW}
        dash={[3, 3]}
      />
      <Label
        text={formatLength(right, unit, 1)}
        x={pxRight + (wall.width * scale - pxRight) / 2 - 14}
        y={pxY + pxH / 2 - 16}
        {...labelStyle}
      />

      {/* Top distance */}
      <Line
        points={[pxX + pxW / 2, 0, pxX + pxW / 2, pxY]}
        stroke={tick}
        strokeWidth={tickW}
        dash={[3, 3]}
      />
      <Label
        text={formatLength(top, unit, 1)}
        x={pxX + pxW / 2 + 4}
        y={pxY / 2 - 7}
        {...labelStyle}
      />

      {/* Bottom-to-floor distance — most useful number for hanging height */}
      <Line
        points={[
          pxX + pxW / 2,
          pxBottom,
          pxX + pxW / 2,
          wall.height * scale,
        ]}
        stroke={tick}
        strokeWidth={tickW}
        dash={[3, 3]}
      />
      <Label
        text={`${formatLength(bottom, unit, 1)} to floor`}
        x={pxX + pxW / 2 + 4}
        y={pxBottom + (wall.height * scale - pxBottom) / 2 - 7}
        {...labelStyle}
        fill={WALL_INK.ink}
      />

      {/* Center-to-floor — the "57in" number */}
      <Label
        text={`center ${formatLength(centerToFloor, unit, 1)} from floor`}
        x={pxX + pxW + 6}
        y={(centerY * scale) - 7}
        fontSize={10}
        fill={WALL_INK.inkMuted}
      />
    </Group>
  );
}

function Redlines({
  segments,
  unit,
  scale,
}: {
  segments: SpacingSegment[];
  unit: "in" | "cm";
  scale: number;
}) {
  return (
    <Group>
      {segments.map((s, i) => {
        const x0 = s.x0 * scale;
        const y0 = s.y0 * scale;
        const x1 = s.x1 * scale;
        const y1 = s.y1 * scale;
        const midX = (x0 + x1) / 2;
        const midY = (y0 + y1) / 2;
        const label = formatLength(s.distance, unit, 1);
        // Tick marks at each end of the dimension line.
        const tick = 4;
        return (
          <Group key={i}>
            <Line
              points={[x0, y0, x1, y1]}
              stroke={REDLINE}
              strokeWidth={1}
            />
            {s.kind === "h" ? (
              <>
                <Line
                  points={[x0, y0 - tick, x0, y0 + tick]}
                  stroke={REDLINE}
                  strokeWidth={1}
                />
                <Line
                  points={[x1, y1 - tick, x1, y1 + tick]}
                  stroke={REDLINE}
                  strokeWidth={1}
                />
                <Text
                  text={label}
                  x={midX - label.length * 2.6}
                  y={midY - 14}
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                  fill={REDLINE}
                />
              </>
            ) : (
              <>
                <Line
                  points={[x0 - tick, y0, x0 + tick, y0]}
                  stroke={REDLINE}
                  strokeWidth={1}
                />
                <Line
                  points={[x1 - tick, y1, x1 + tick, y1]}
                  stroke={REDLINE}
                  strokeWidth={1}
                />
                <Text
                  text={label}
                  x={midX + 6}
                  y={midY - 6}
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                  fill={REDLINE}
                />
              </>
            )}
          </Group>
        );
      })}
    </Group>
  );
}

function Label({
  text,
  x,
  y,
  fontSize = 10,
  fill = WALL_INK.ink as string,
}: {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fill?: string;
  padding?: number;
}) {
  return (
    <Text
      text={text}
      x={x}
      y={y}
      fontSize={fontSize}
      fontFamily="Inter, sans-serif"
      fill={fill}
    />
  );
}
