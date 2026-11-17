"use client";

import { Circle, Group, Image as KImage, Line, Rect, Text } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { WALL_INK } from "@/lib/canvasTheme";
import { framePadding, outerSize } from "@/lib/geometry";
import type { Item } from "@/lib/types";

type Props = {
  item: Item;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: (xMm: number, yMm: number) => void;
  onDragEnd: (xMm: number, yMm: number) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
};

export default function ItemNode({
  item,
  scale,
  selected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragBoundFunc,
}: Props) {
  const [img] = useImage(item.imageSrc, "anonymous");

  const frameW = item.frame?.frameWidth ?? 0;
  const pad = framePadding(item);
  const { width: totalW, height: totalH } = outerSize(item);

  return (
    <Group
      x={item.x * scale}
      y={item.y * scale}
      draggable
      dragBoundFunc={dragBoundFunc}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        onDragMove(node.x() / scale, node.y() / scale);
      }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        onDragEnd(e.target.x() / scale, e.target.y() / scale);
      }}
    >
      {item.frame && (
        <>
          <Rect
            width={totalW * scale}
            height={totalH * scale}
            fill={item.frame.frameColor}
          />
          <Rect
            x={frameW * scale}
            y={frameW * scale}
            width={(totalW - frameW * 2) * scale}
            height={(totalH - frameW * 2) * scale}
            fill={WALL_INK.mat}
          />
        </>
      )}
      {img ? (
        <KImage
          image={img}
          x={pad * scale}
          y={pad * scale}
          width={item.artWidth * scale}
          height={item.artHeight * scale}
        />
      ) : (
        <Rect
          x={pad * scale}
          y={pad * scale}
          width={item.artWidth * scale}
          height={item.artHeight * scale}
          fill={WALL_INK.placeholder}
        />
      )}
      {!item.frame && (
        <Rect
          x={pad * scale}
          y={pad * scale}
          width={item.artWidth * scale}
          height={item.artHeight * scale}
          stroke={WALL_INK.edge}
          strokeWidth={1}
          listening={false}
        />
      )}
      {selected && (
        <Rect
          width={totalW * scale}
          height={totalH * scale}
          stroke={WALL_INK.brand}
          strokeWidth={1}
          dash={[6, 4]}
          listening={false}
        />
      )}
      {selected && (
        <Text
          text={item.name || "Untitled"}
          y={-16}
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill={WALL_INK.brand}
        />
      )}
      {item.pinned && (
        // Map-pin badge in the top-right corner of the piece. Brand-blue
        // head + pointed base + cream dot. Excluded from listening so it
        // doesn't intercept drags on the piece below.
        <Group x={totalW * scale - 12} y={6} listening={false}>
          <Circle radius={6} fill={WALL_INK.brand} />
          <Line points={[0, 4, -4, 10, 4, 10]} closed fill={WALL_INK.brand} />
          <Circle radius={1.5} fill={WALL_INK.mat} />
        </Group>
      )}
    </Group>
  );
}
