"use client";

import { Group, Image as KImage, Rect, Text } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
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
  const [img] = useImage(item.imageDataUrl, "anonymous");

  const frameW = item.frame?.frameWidth ?? 0;
  const matW = item.frame?.matWidth ?? 0;
  const pad = frameW + matW;

  const totalW = item.artWidth + pad * 2;
  const totalH = item.artHeight + pad * 2;

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
            fill="#FBF9F4"
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
          fill="#E2DCCF"
        />
      )}
      {!item.frame && (
        <Rect
          x={pad * scale}
          y={pad * scale}
          width={item.artWidth * scale}
          height={item.artHeight * scale}
          stroke="#B6B4AF"
          strokeWidth={1}
          listening={false}
        />
      )}
      {selected && (
        <Rect
          width={totalW * scale}
          height={totalH * scale}
          stroke="#0021CC"
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
          fill="#0021CC"
        />
      )}
    </Group>
  );
}
