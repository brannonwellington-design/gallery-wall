"use client";

import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { WALL_INK } from "@/lib/canvasTheme";
import { FURNITURE_CLEARANCE_MM, fixtureLabel, isFurniture } from "@/lib/fixtures";
import type { Fixture } from "@/lib/types";

type Props = {
  fixture: Fixture;
  scale: number;
  selected: boolean;
  unitLabel: string;
  onSelect: () => void;
  onDragEnd: (xMm: number, yMm: number) => void;
  dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number };
};

/**
 * A fixture drawn on the wall: furniture as a soft silhouette, openings and
 * electrical as outlines. Drawn under the art; draggable.
 */
export default function FixtureNode({
  fixture,
  scale,
  selected,
  unitLabel,
  onSelect,
  onDragEnd,
  dragBoundFunc,
}: Props) {
  const w = fixture.width * scale;
  const h = fixture.height * scale;
  const label = fixtureLabel(fixture);
  const small = w < 40 || h < 24;

  return (
    <Group
      x={fixture.x * scale}
      y={fixture.y * scale}
      draggable
      dragBoundFunc={dragBoundFunc}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
        onDragEnd(e.target.x() / scale, e.target.y() / scale)
      }
    >
      <Shape kind={fixture.kind} w={w} h={h} />
      {!small ? (
        <Text
          text={label}
          width={w}
          y={fixture.kind === "tv" ? h / 2 - 6 : Math.max(4, h / 2 - 6)}
          align="center"
          fontSize={11}
          fontFamily="Inter, sans-serif"
          fill={fixture.kind === "tv" ? WALL_INK.mat : WALL_INK.inkMuted}
          listening={false}
        />
      ) : null}
      {isFurniture(fixture) ? (
        // The "hang art this far above" line.
        <Group y={-FURNITURE_CLEARANCE_MM * scale} listening={false}>
          <Line points={[0, 0, w, 0]} stroke={WALL_INK.brandSoft} strokeWidth={1} dash={[2, 4]} />
          <Text
            text={`8${unitLabel} above`}
            x={w + 4}
            y={-5}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill={WALL_INK.brandSoft}
          />
        </Group>
      ) : null}
      {selected ? (
        <Rect width={w} height={h} stroke={WALL_INK.brand} strokeWidth={1} dash={[6, 4]} listening={false} />
      ) : null}
    </Group>
  );
}

function Shape({ kind, w, h }: { kind: Fixture["kind"]; w: number; h: number }) {
  const stroke = WALL_INK.fixtureStroke;
  switch (kind) {
    case "sofa": {
      const arm = Math.min(w * 0.08, h * 0.5);
      const seat = h * 0.45;
      return (
        <>
          <Rect width={w} height={h} fill={WALL_INK.fixture} cornerRadius={Math.min(10, h * 0.2)} />
          <Rect y={h - seat} width={w} height={seat} fill={WALL_INK.fixtureShade} cornerRadius={4} />
          <Rect y={h * 0.3} width={arm} height={h * 0.7} fill={WALL_INK.fixtureShade} cornerRadius={4} />
          <Rect x={w - arm} y={h * 0.3} width={arm} height={h * 0.7} fill={WALL_INK.fixtureShade} cornerRadius={4} />
        </>
      );
    }
    case "console":
    case "bed":
      return (
        <>
          <Rect width={w} height={h} fill={WALL_INK.fixture} cornerRadius={kind === "bed" ? 8 : 2} />
          {kind === "console" ? <Line points={[0, h * 0.3, w, h * 0.3]} stroke={stroke} strokeWidth={1} /> : null}
        </>
      );
    case "door":
      return (
        <>
          <Rect width={w} height={h} fill={WALL_INK.mat} stroke={stroke} strokeWidth={1} />
          <Circle x={w * 0.85} y={h * 0.52} radius={Math.max(2, w * 0.03)} fill={stroke} />
        </>
      );
    case "window":
      return (
        <>
          <Rect width={w} height={h} fill="#EEF2F6" stroke={stroke} strokeWidth={2} />
          <Line points={[w / 2, 0, w / 2, h]} stroke={stroke} strokeWidth={1} />
          <Line points={[0, h / 2, w, h / 2]} stroke={stroke} strokeWidth={1} />
        </>
      );
    case "tv":
      return <Rect width={w} height={h} fill={WALL_INK.ink} cornerRadius={2} />;
    case "outlet":
    case "switch":
      return (
        <>
          <Rect width={w} height={h} fill={WALL_INK.surface} stroke={stroke} strokeWidth={1} cornerRadius={1} />
          <Rect x={w * 0.35} y={h * 0.3} width={w * 0.3} height={h * 0.4} fill={stroke} />
        </>
      );
    case "sconce":
      return <Rect width={w} height={h} fill={WALL_INK.fixture} stroke={stroke} strokeWidth={1} cornerRadius={w / 2} />;
    default:
      return <Rect width={w} height={h} fill={WALL_INK.fixture} stroke={stroke} strokeWidth={1} dash={[4, 3]} />;
  }
}
