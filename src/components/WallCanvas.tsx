"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import type Konva from "konva";
import type { Room } from "@/lib/types";
import { formatLength } from "@/lib/units";
import ItemNode from "./ItemNode";

type Props = {
  room: Room;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveItem: (id: string, xMm: number, yMm: number) => void;
};

const PADDING = 48;

const WallCanvas = forwardRef<Konva.Stage, Props>(function WallCanvas(
  { room, selectedId, onSelect, onMoveItem },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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
          <Layer>
            {/* Wall surface */}
            <Rect
              x={offsetX}
              y={offsetY}
              width={wallPxW}
              height={wallPxH}
              fill="#ffffff"
              stroke="#9ca3af"
              strokeWidth={1}
            />

            {/* Item layer (positioned relative to wall origin) */}
          </Layer>
          <Layer x={offsetX} y={offsetY}>
            {room.items.map((item) => (
              <ItemNode
                key={item.id}
                item={item}
                scale={scale}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                onDragEnd={(x, y) => onMoveItem(item.id, x, y)}
              />
            ))}
          </Layer>
          <Layer listening={false}>
            {/* Floor line — always shown, drawn on top */}
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
            {/* Wall dimension labels */}
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
