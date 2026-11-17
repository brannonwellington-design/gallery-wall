"use client";

import { Circle, Group, Image as KImage, Line, Rect, Text } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { WALL_INK } from "@/lib/canvasTheme";
import { framePadding, nailPoints, outerSize } from "@/lib/geometry";
import type { Item } from "@/lib/types";

type Props = {
  item: Item;
  scale: number;
  selected: boolean;
  /** Someone else has this piece selected: outline it in their color. */
  remote?: { color: string; name: string };
  /** additive: Shift/⌘-click toggles the piece in the selection. */
  onSelect: (additive: boolean) => void;
  onDragStart: (additive: boolean) => void;
  onDragMove: (xMm: number, yMm: number) => void;
  onDragEnd: (xMm: number, yMm: number) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
};

export default function ItemNode({
  item,
  scale,
  selected,
  remote,
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
      id={`item-${item.id}`}
      x={item.x * scale}
      y={item.y * scale}
      // Pinned means pinned: no dragging (select it and unpin to move).
      draggable={!item.pinned}
      dragBoundFunc={dragBoundFunc}
      onClick={(e: Konva.KonvaEventObject<MouseEvent>) =>
        onSelect(e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)
      }
      onTap={() => onSelect(false)}
      onDragStart={(e: Konva.KonvaEventObject<DragEvent>) =>
        onDragStart(e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)
      }
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
      {remote && !selected ? (
        <>
          <Rect
            width={totalW * scale}
            height={totalH * scale}
            stroke={remote.color}
            strokeWidth={2}
            listening={false}
          />
          <Text
            text={remote.name}
            y={-14}
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fill={remote.color}
            listening={false}
          />
        </>
      ) : null}
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
      {selected &&
        // Where the nail(s) go, from the piece's hanger (or the default).
        nailPoints(item, 0).map((n, i) => (
          <Group
            key={`nail-${i}`}
            x={(n.fromLeft - item.x) * scale}
            y={(n.y - item.y) * scale}
            listening={false}
          >
            <Circle radius={4} fill={WALL_INK.surface} stroke={WALL_INK.redline} strokeWidth={1.5} />
            <Line points={[-6, 0, 6, 0]} stroke={WALL_INK.redline} strokeWidth={1} />
            <Line points={[0, -6, 0, 6]} stroke={WALL_INK.redline} strokeWidth={1} />
          </Group>
        ))}
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
