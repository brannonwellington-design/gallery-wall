import { eyeLine, framePadding } from "@/lib/geometry";
import type { GuideRow } from "@/lib/hangingGuide";
import type { Room } from "@/lib/types";
import { formatTape } from "@/lib/units";

type Props = { room: Room; rows: GuideRow[] };

/**
 * To-scale elevation of the wall for the printed guide: numbered pieces and
 * a red cross at every nail. SVG in wall millimetres, so it scales to any
 * page width.
 */
export default function WallDiagram({ room, rows }: Props) {
  const { wallWidth: W, wallHeight: H } = room;
  const unit = Math.max(W, H);
  const font = unit / 55;
  const margin = font * 4;
  const eye = eyeLine(room);
  const badge = font * 0.9;
  const cross = font * 0.55;

  return (
    <svg
      viewBox={`${-margin} ${-margin} ${W + margin * 2} ${H + margin * 2}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Wall elevation, ${formatTape(W, room.unit)} wide by ${formatTape(H, room.unit)} tall, with ${rows.length} numbered pieces and their nail positions`}
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" stroke="var(--content-disabled)" strokeWidth={unit / 1200} />
      <line x1={-margin / 2} y1={H} x2={W + margin / 2} y2={H} stroke="var(--content-secondary)" strokeWidth={unit / 800} />
      <text x={W + margin / 2} y={H + font * 1.4} fontSize={font * 0.8} textAnchor="end" fill="var(--content-secondary)">
        Floor
      </text>
      <text x={W / 2} y={-font * 0.8} fontSize={font} textAnchor="middle" fill="var(--content-secondary)">
        {formatTape(W, room.unit)}
      </text>
      <text
        x={-font * 0.8}
        y={H / 2}
        fontSize={font}
        textAnchor="middle"
        fill="var(--content-secondary)"
        transform={`rotate(-90 ${-font * 0.8} ${H / 2})`}
      >
        {formatTape(H, room.unit)}
      </text>

      {eye ? (
        <g>
          <line x1={0} y1={eye.y} x2={W} y2={eye.y} stroke="#E5A119" strokeWidth={unit / 900} strokeDasharray={`${font} ${font * 0.6}`} />
          <text x={W - font * 0.3} y={eye.y - font * 0.4} fontSize={font * 0.8} textAnchor="end" fill="var(--content-complimentary)">
            eye line {formatTape(eye.heightFromFloor, room.unit)}
          </text>
        </g>
      ) : null}

      {rows.map(({ number, item, rect, nails }) => {
        const pad = framePadding(item);
        const matInset = item.frame?.frameWidth ?? 0;
        return (
          <g key={item.id}>
            {item.frame ? (
              <>
                <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={item.frame.frameColor} />
                <rect
                  x={rect.x + matInset}
                  y={rect.y + matInset}
                  width={rect.width - matInset * 2}
                  height={rect.height - matInset * 2}
                  fill="#FBF9F4"
                />
              </>
            ) : null}
            <image
              href={item.imageSrc}
              x={rect.x + pad}
              y={rect.y + pad}
              width={item.artWidth}
              height={item.artHeight}
              preserveAspectRatio="none"
              opacity={0.85}
            />
            {!item.frame ? (
              <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke="var(--content-disabled)" strokeWidth={unit / 1500} />
            ) : null}
            {/* Bottom-left, away from the nails (which sit near the top). */}
            <circle cx={rect.x + badge * 1.3} cy={rect.y + rect.height - badge * 1.3} r={badge} fill="var(--surface-brand-primary)" />
            <text
              x={rect.x + badge * 1.3}
              y={rect.y + rect.height - badge * 1.3}
              fontSize={badge * 1.1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#F9F4EB"
            >
              {number}
            </text>
            {nails.map((n, i) => (
              <g key={i} stroke="var(--content-negative)" strokeWidth={unit / 1000}>
                <circle cx={n.fromLeft} cy={n.y} r={cross * 0.6} fill="#FFFFFF" />
                <line x1={n.fromLeft - cross} y1={n.y} x2={n.fromLeft + cross} y2={n.y} />
                <line x1={n.fromLeft} y1={n.y - cross} x2={n.fromLeft} y2={n.y + cross} />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
