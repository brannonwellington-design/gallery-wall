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
      // Update guide state for rendering (batched by React).
      setGuides(result.guides);
      setDragging({ id: item.id, x: result.x, y: result.y });
      return {
        x: offsetX + result.x * scale,
        y: offsetY + result.y * scale,
      };
    },
    [offsetX, offsetY, scale, room.items, room.wallWidth, room.wallHeight, snapEnabled, eyeLineY],
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
      className="relative w-full h-full bg-zinc-100 overflow-hidden"
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
          {/* Wall surface */}
          <Layer>
            <Rect
              x={offsetX}
              y={offsetY}
              width={wallPxW}
              height={wallPxH}
              fill="#ffffff"
              stroke="#9ca3af"
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
                  stroke="#d97706"
                  strokeWidth={1}
                  dash={[6, 4]}
                  opacity={0.55}
                  listening={false}
                />
                <Text
                  text={`eye ${formatLength(eyeLineHeight, room.unit, 1)}`}
                  x={offsetX + wallPxW + 6}
                  y={offsetY + eyeLineY * scale - 7}
                  fontSize={10}
                  fill="#92400e"
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
              stroke="#475569"
              strokeWidth={2}
            />
            <Text
              text="FLOOR"
              x={offsetX + wallPxW + 28}
              y={offsetY + wallPxH - 6}
              fontSize={11}
              fill="#475569"
              fontStyle="bold"
            />
            <Text
              text={formatLength(room.wallWidth, room.unit, 1)}
              x={offsetX + wallPxW / 2 - 30}
              y={offsetY - 22}
              fontSize={12}
              fill="#374151"
            />
            <Text
              text={formatLength(room.wallHeight, room.unit, 1)}
              x={offsetX - 44}
              y={offsetY + wallPxH / 2 - 6}
              fontSize={12}
              fill="#374151"
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
});

export default WallCanvas;

function guideColor(reason: Guide["reason"]): string {
  switch (reason) {
    case "wall-edge":
    case "item-edge":
      return "#2563eb";
    case "wall-center":
    case "item-center":
      return "#ec4899";
    case "equal-spacing":
      return "#10b981";
    case "eye-line":
      return "#d97706";
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
    fontSize: 11,
    fill: "#1f2937",
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
  const tick = "#94a3b8";
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
        fill="#0f172a"
        weight="bold"
      />

      {/* Center-to-floor — the "57in" number */}
      <Label
        text={`center ${formatLength(centerToFloor, unit, 1)} from floor`}
        x={pxX + pxW + 6}
        y={(centerY * scale) - 7}
        fontSize={10}
        fill="#475569"
      />
    </Group>
  );
}

function Label({
  text,
  x,
  y,
  fontSize = 11,
  fill = "#1f2937",
  weight,
}: {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fill?: string;
  padding?: number;
  weight?: "bold";
}) {
  return (
    <Text
      text={text}
      x={x}
      y={y}
      fontSize={fontSize}
      fill={fill}
      fontStyle={weight === "bold" ? "bold" : undefined}
    />
  );
}
