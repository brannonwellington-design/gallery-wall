"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type Konva from "konva";
import type { Item, Room } from "@/lib/types";
import { DEFAULT_EYE_LINE_HEIGHT_MM } from "@/lib/defaults";
import { formatLength } from "@/lib/units";
import { computeSnap, type Guide, type Rect as SnapRect } from "@/lib/snap";
import ItemNode from "./ItemNode";

type Props = {
  room: Room;
  selectedId: string | null;
  snapEnabled: boolean;
  onSelect: (id: string | null) => void;
  onMoveItem: (id: string, xMm: number, yMm: number) => void;
};

const PADDING = 56;
const SNAP_THRESHOLD_PX = 6;

function itemRect(item: Item): SnapRect {
  const pad = (item.frame?.frameWidth ?? 0) + (item.frame?.matWidth ?? 0);
  return {
    x: item.x,
    y: item.y,
    width: item.artWidth + pad * 2,
    height: item.artHeight + pad * 2,
  };
}

const WallCanvas = forwardRef<Konva.Stage, Props>(function WallCanvas(
  { room, selectedId, snapEnabled, onSelect, onMoveItem },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const scale = Math.min(scaleX, scaleY) || 1;
  const wallPxW = room.wallWidth * scale;
  const wallPxH = room.wallHeight * scale;
  const offsetX = (size.w - wallPxW) / 2;
  const offsetY = (size.h - wallPxH) / 2;

  const eyeLineEnabled = room.eyeLineEnabled ?? true;
  const eyeLineHeight = room.eyeLineHeight ?? DEFAULT_EYE_LINE_HEIGHT_MM;
  // Eye-line stored as height from FLOOR; in wall coords (y grows down) it
  // lives at (wallHeight - eyeLineHeight). Only valid when within the wall.
  const eyeLineY =
    eyeLineEnabled &&
    eyeLineHeight > 0 &&
    eyeLineHeight < room.wallHeight
      ? room.wallHeight - eyeLineHeight
      : null;

  // Build a per-item dragBoundFunc that snaps in mm and returns absolute
  // stage coords for Konva to use as the new node position.
  const makeDragBoundFunc = useCallback(
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
      const others = room.items
        .filter((it) => it.id !== item.id)
        .map(itemRect);
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
    },
    [offsetX, offsetY, scale, room.items, room.wallWidth, room.wallHeight, snapEnabled, eyeLineY, scheduleDragVisuals],
  );

  // Decide which rect to show measurements for.
  const measureItem: { rect: SnapRect } | null = (() => {
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
            if (e.target === e.target.getStage()) onSelect(null);
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
              fill="#FFFFFF"
              stroke="#B6B4AF"
              strokeWidth={1}
            />
            {eyeLineY != null && (
              <>
                <Line
                  points={[
                    offsetX,
                    offsetY + eyeLineY * scale,
                    offsetX + wallPxW,
                    offsetY + eyeLineY * scale,
                  ]}
                  stroke="#E5A119"
                  strokeWidth={1}
                  dash={[6, 4]}
                  opacity={0.6}
                  listening={false}
                />
                <Text
                  text={`eye ${formatLength(eyeLineHeight, room.unit, 1)}`}
                  x={offsetX + wallPxW + 6}
                  y={offsetY + eyeLineY * scale - 7}
                  fontSize={10}
                  fontFamily="Inter, sans-serif"
                  fill="#B88114"
                  listening={false}
                />
              </>
            )}
          </Layer>

          {/* Items (positioned relative to wall origin) */}
          <Layer x={offsetX} y={offsetY}>
            {room.items.map((item) => (
              <ItemNode
                key={item.id}
                item={item}
                scale={scale}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                onDragStart={() => {
                  onSelect(item.id);
                  setDragging({ id: item.id, x: item.x, y: item.y });
                }}
                onDragMove={() => {
                  /* dragBoundFunc updates dragging state */
                }}
                onDragEnd={(x, y) => {
                  if (guidesRaf.current != null) {
                    cancelAnimationFrame(guidesRaf.current);
                    guidesRaf.current = null;
                  }
                  pendingDrag.current = null;
                  setDragging(null);
                  setGuides([]);
                  onMoveItem(item.id, x, y);
                }}
                dragBoundFunc={makeDragBoundFunc(item)}
              />
            ))}
          </Layer>

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
              stroke="#6B6861"
              strokeWidth={1}
            />
            <Text
              text="Floor"
              x={offsetX + wallPxW + 28}
              y={offsetY + wallPxH - 6}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill="#6B6861"
            />
            <Text
              text={formatLength(room.wallWidth, room.unit, 1)}
              x={offsetX + wallPxW / 2 - 30}
              y={offsetY - 20}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill="#6B6861"
            />
            <Text
              text={formatLength(room.wallHeight, room.unit, 1)}
              x={offsetX - 44}
              y={offsetY + wallPxH / 2 - 6}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill="#6B6861"
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
});

export default WallCanvas;

function guideColor(reason: Guide["reason"]): string {
  // Brand-aware semantic guide palette.
  switch (reason) {
    case "wall-edge":
    case "item-edge":
      return "#0021CC"; // surface-brand-primary
    case "wall-center":
    case "item-center":
      return "#7A85B8"; // content-brand-secondary
    case "equal-spacing":
      return "#14B84B"; // surface-positive-primary
    case "eye-line":
      return "#E5A119"; // surface-complimentary-primary
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
    fill: "#120F08",
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
  const tick = "#B6B4AF"; // content-disabled
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
        fill="#120F08"
      />

      {/* Center-to-floor — the "57in" number */}
      <Label
        text={`center ${formatLength(centerToFloor, unit, 1)} from floor`}
        x={pxX + pxW + 6}
        y={(centerY * scale) - 7}
        fontSize={10}
        fill="#6B6861"
      />
    </Group>
  );
}

function Label({
  text,
  x,
  y,
  fontSize = 10,
  fill = "#120F08",
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
