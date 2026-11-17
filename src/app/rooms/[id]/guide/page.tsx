import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BrandedHeader from "@/components/BrandedHeader";
import PrintButton from "@/components/guide/PrintButton";
import WallDiagram from "@/components/guide/WallDiagram";
import { Button } from "@/components/ui/button";
import { eyeLine } from "@/lib/geometry";
import { buildHangingGuide, type GuideRow } from "@/lib/hangingGuide";
import { getRepo } from "@/lib/repo";
import type { Unit } from "@/lib/types";
import { formatTape } from "@/lib/units";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const record = await getRepo().get(id).catch(() => null);
  return { title: `${record?.room.name ?? "Room"} — Hanging guide` };
}

export default async function HangingGuidePage({ params }: Params) {
  const { id } = await params;
  const record = await getRepo().get(id);
  if (!record) {
    return (
      <main className="max-w-[720px] mx-auto px-6 pt-24">
        <h1 className="text-title text-content-primary mb-2">Room not found</h1>
        <p className="text-body text-content-secondary">This room may have been deleted.</p>
      </main>
    );
  }

  const { room } = record;
  const rows = buildHangingGuide(room);
  const eye = eyeLine(room);
  const unit = room.unit;
  const anyAssumed = rows.some((r) => r.hanger.assumed);

  return (
    <div className="min-h-screen bg-surface-primary text-content-secondary print:bg-white">
      <div className="print:hidden">
        <BrandedHeader title="Hanging Guide" />
      </div>

      <main className="max-w-[960px] mx-auto px-6 md:px-12 pt-20 pb-24 print:p-0 print:max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-10 print:hidden">
          <Button variant="ghost" className="-ml-2 text-label" asChild>
            <Link href={`/rooms/${id}`}>
              <ArrowLeft size={14} strokeWidth={1} aria-hidden="true" />
              Back to the wall
            </Link>
          </Button>
          <PrintButton />
        </div>

        <header className="mb-8">
          <div className="text-caption text-content-disabled mb-2">Hanging guide</div>
          <h1 className="text-display text-content-primary mb-3 print:text-title">{room.name}</h1>
          <p className="text-label text-content-secondary tabular">
            Wall {formatTape(room.wallWidth, unit)} wide × {formatTape(room.wallHeight, unit)} tall
            {" · "}
            {rows.length} {rows.length === 1 ? "piece" : "pieces"}
            {eye ? ` · eye line ${formatTape(eye.heightFromFloor, unit)} from the floor` : ""}
          </p>
        </header>

        <section className="mb-10 grid gap-2 text-body text-content-primary md:grid-cols-2 print:grid-cols-2 print:text-label">
          <Step n={1}>Measure every nail from the <b className="font-normal underline">left edge of the wall</b> across, then from the <b className="font-normal underline">floor</b> up (the floor itself, not the top of the baseboard).</Step>
          <Step n={2}>Mark each spot in pencil and check it against the diagram before you drill.</Step>
          <Step n={3}>For pieces with two hooks, mark both nails and check they&apos;re level with each other.</Step>
          <Step n={4}>Hang in the order shown — left to right — and step back after each one.</Step>
        </section>

        {anyAssumed ? (
          <p className="mb-6 rounded-lg border border-surface-tertiary bg-surface-complimentary-secondary px-4 py-3 text-label text-content-primary">
            Some pieces don&apos;t have their hanger measured yet, so their nail height assumes picture wire 2″ below the top. Pull the wire taut toward the top, measure to its peak, and enter it under the piece&apos;s Hanging settings — or adjust each nail by the difference.
          </p>
        ) : null}

        <figure className="mb-12 break-inside-avoid">
          <div className="rounded-lg border border-surface-tertiary bg-surface-secondary p-4 print:border-0 print:bg-transparent print:p-0">
            <WallDiagram room={room} rows={rows} />
          </div>
          <figcaption className="mt-2 text-caption text-content-disabled">
            Numbers match the list below. Red crosses mark the nails. Drawn to scale.
          </figcaption>
        </figure>

        {rows.length === 0 ? (
          <p className="text-body text-content-secondary">No pieces on this wall yet.</p>
        ) : (
          <ol className="flex flex-col">
            {rows.map((row) => (
              <GuideItem key={row.item.id} row={row} unit={unit} />
            ))}
          </ol>
        )}

        <p className="mt-12 text-caption text-content-disabled">
          Generated {new Date(record.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}{" "}
          from the room&apos;s last saved version. Measurements are rounded to the nearest {unit === "in" ? "⅛″" : "millimetre"}.
        </p>
      </main>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-brand-primary text-label text-content-brand-contrast">
        {n}
      </span>
      <p className="pt-0.5">{children}</p>
    </div>
  );
}

function GuideItem({ row, unit }: { row: GuideRow; unit: Unit }) {
  const { number, item, rect, hanger, nails, topFromFloor, centerFromFloor, warnings } = row;
  const hangerText =
    hanger.kind === "pair"
      ? `Two hooks ${formatTape(hanger.spacing, unit)} apart, ${formatTape(hanger.drop, unit)} below the top`
      : `One hook, ${formatTape(hanger.drop, unit)} below the top`;

  return (
    <li className="flex gap-4 border-t border-surface-tertiary py-5 break-inside-avoid">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-brand-primary text-body text-content-brand-contrast tabular">
        {number}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageSrc}
        alt=""
        className="size-16 shrink-0 rounded-sm border border-surface-tertiary bg-surface-highlight object-contain"
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-lead text-content-primary truncate">{item.name || "Untitled"}</h2>
        <p className="text-label text-content-secondary tabular">
          {formatTape(rect.width, unit)} × {formatTape(rect.height, unit)}
          {item.frame ? " framed" : ""} · {hangerText}
          {hanger.assumed ? " (assumed)" : ""}
        </p>

        <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
          {nails.map((n, i) => (
            <div key={i} className="rounded-lg bg-surface-highlight px-3 py-2 print:border print:border-surface-tertiary">
              <div className="text-caption text-content-disabled">
                {nails.length === 2 ? (i === 0 ? "Left nail" : "Right nail") : "Nail"}
              </div>
              <div className="text-body text-content-primary tabular">
                {formatTape(n.fromLeft, unit)} from the left
                <span className="text-content-disabled"> · </span>
                {formatTape(n.fromFloor, unit)} up from the floor
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 text-caption text-content-disabled tabular">
          Top of piece {formatTape(topFromFloor, unit)} from the floor · center {formatTape(centerFromFloor, unit)}
        </p>
        {warnings.filter((w) => !w.startsWith("Hanger not measured")).map((w) => (
          <p key={w} className="mt-1 text-caption text-content-negative">
            {w}
          </p>
        ))}
      </div>
    </li>
  );
}
