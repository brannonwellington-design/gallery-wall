"use client";

import type { Item, Unit } from "@/lib/types";
import { formatLength } from "@/lib/units";

type Props = {
  items: Item[];
  unit: Unit;
  selectedId: string | null;
  bgBusyId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onToggleBackground: (id: string) => void;
};

export default function ItemsList({
  items,
  unit,
  selectedId,
  bgBusyId,
  onSelect,
  onRemove,
  onToggleBackground,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-zinc-500">
        No pieces yet. Add one below.
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((it) => {
        const active = it.id === selectedId;
        const bgRemoved = Boolean(it.imageOriginalDataUrl);
        const bgBusy = bgBusyId === it.id;
        return (
          <li
            key={it.id}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer text-sm group ${
              active ? "bg-blue-50" : "hover:bg-zinc-50"
            }`}
            onClick={() => onSelect(it.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.imageDataUrl}
              alt=""
              className="w-8 h-8 object-cover rounded border border-zinc-200 bg-white"
              style={
                bgRemoved
                  ? {
                      backgroundImage:
                        "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)",
                      backgroundSize: "8px 8px",
                    }
                  : undefined
              }
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-zinc-800">{it.name}</div>
              <div className="text-[11px] text-zinc-500">
                {formatLength(it.artWidth, unit)} × {formatLength(it.artHeight, unit)}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBackground(it.id);
              }}
              disabled={bgBusy}
              className={`text-[11px] px-1.5 py-0.5 rounded border transition-opacity ${
                bgRemoved
                  ? "border-blue-300 bg-blue-50 text-blue-700 opacity-100"
                  : "border-zinc-300 text-zinc-600 opacity-0 group-hover:opacity-100"
              } disabled:opacity-100 disabled:cursor-wait`}
              title={
                bgRemoved
                  ? "Restore original background"
                  : "Remove background (uses Replicate)"
              }
            >
              {bgBusy ? "…" : bgRemoved ? "+BG" : "−BG"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(it.id);
              }}
              className="text-zinc-400 hover:text-red-600 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${it.name}`}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
