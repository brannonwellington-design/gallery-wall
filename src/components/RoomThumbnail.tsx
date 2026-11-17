import type { RoomPreview } from "@/lib/types";

const FIXTURE_FILL: Record<string, string> = {
  tv: "#1F1B14",
  window: "#E3E9EF",
};

/**
 * Small to-scale sketch of a wall for the rooms list: the wall, its
 * furniture and fixtures as soft shapes, and every piece with its image.
 */
export default function RoomThumbnail({ preview, label }: { preview?: RoomPreview; label: string }) {
  if (!preview) {
    return <div className="aspect-[3/2] w-full rounded-md bg-surface-secondary" aria-hidden="true" />;
  }
  const { wallWidth: W, wallHeight: H } = preview;
  const pad = Math.max(W, H) * 0.06;
  const hairline = Math.max(W, H) / 400;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="aspect-[3/2] w-full rounded-md bg-surface-secondary"
      role="img"
      aria-label={`Preview of ${label}: ${preview.items.length} ${preview.items.length === 1 ? "piece" : "pieces"}`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" stroke="#E2DCCF" strokeWidth={hairline} />
      <line x1={-pad / 2} y1={H} x2={W + pad / 2} y2={H} stroke="#B6B4AF" strokeWidth={hairline * 1.5} />
      {preview.fixtures.map((f, i) => (
        <rect
          key={`f${i}`}
          x={f.x}
          y={f.y}
          width={f.width}
          height={f.height}
          rx={f.kind === "sofa" || f.kind === "bed" ? Math.min(f.width, f.height) * 0.12 : 0}
          fill={FIXTURE_FILL[f.kind] ?? "#EEE8DD"}
        />
      ))}
      {preview.items.map((it, i) => {
        const inset = it.frameColor ? Math.min(it.width, it.height) * 0.06 : 0;
        return (
          <g key={`p${i}`}>
            {it.frameColor ? (
              <rect x={it.x} y={it.y} width={it.width} height={it.height} fill={it.frameColor} />
            ) : null}
            {it.image ? (
              <image
                href={it.image}
                x={it.x + inset}
                y={it.y + inset}
                width={it.width - inset * 2}
                height={it.height - inset * 2}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <rect
                x={it.x + inset}
                y={it.y + inset}
                width={it.width - inset * 2}
                height={it.height - inset * 2}
                fill="#E2DCCF"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
