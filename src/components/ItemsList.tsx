"use client";

import { Loader2, Pin, PinOff, Scissors, Trash2, Undo2 } from "lucide-react";
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
  onTogglePin: (id: string) => void;
};

export default function ItemsList({
  items,
  unit,
  selectedId,
  bgBusyId,
  onSelect,
  onRemove,
  onToggleBackground,
  onTogglePin,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="px-6 py-4 text-[12px] leading-4 text-content-disabled">
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
            className={`flex items-center gap-3 px-6 py-3 cursor-pointer ${
              active
                ? "bg-surface-brand-secondary"
                : "hover:bg-surface-secondary"
            }`}
            onClick={() => onSelect(it.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.imageDataUrl}
              alt=""
              className="w-10 h-10 object-cover rounded-sm border border-surface-tertiary bg-surface-highlight"
              style={
                bgRemoved
                  ? {
                      backgroundImage:
                        "repeating-conic-gradient(var(--surface-tertiary) 0% 25%, var(--surface-highlight) 0% 50%)",
                      backgroundSize: "8px 8px",
                    }
                  : undefined
              }
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[14px] leading-5 text-content-primary">
                {it.name}
              </div>
              <div className="text-[10px] leading-4 text-content-disabled tabular">
                {formatLength(it.artWidth, unit)} ×{" "}
                {formatLength(it.artHeight, unit)}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBackground(it.id);
              }}
              disabled={bgBusy}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${
                bgRemoved
                  ? "text-content-brand bg-surface-brand-secondary hover:opacity-80"
                  : "text-content-secondary hover:text-content-primary hover:bg-surface-tertiary"
              } disabled:opacity-60 disabled:cursor-wait`}
              title={
                bgBusy
                  ? "Removing background…"
                  : bgRemoved
                    ? "Restore original background"
                    : "Remove background (uses Replicate)"
              }
              aria-label={
                bgRemoved ? "Restore background" : "Remove background"
              }
            >
              {bgBusy ? (
                <Loader2
                  size={14}
                  strokeWidth={1.25}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : bgRemoved ? (
                <Undo2 size={14} strokeWidth={1.25} aria-hidden="true" />
              ) : (
                <Scissors size={14} strokeWidth={1.25} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(it.id);
              }}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${
                it.pinned
                  ? "text-content-brand bg-surface-brand-secondary hover:opacity-80"
                  : "text-content-secondary hover:text-content-primary hover:bg-surface-tertiary"
              }`}
              aria-label={it.pinned ? "Unpin piece" : "Pin piece"}
              aria-pressed={!!it.pinned}
              title={
                it.pinned
                  ? "Unpin — let Randomize move this piece"
                  : "Pin — keep this piece in place when randomizing"
              }
            >
              {it.pinned ? (
                <PinOff size={14} strokeWidth={1.25} aria-hidden="true" />
              ) : (
                <Pin size={14} strokeWidth={1.25} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(it.id);
              }}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-content-secondary hover:text-content-negative hover:bg-surface-negative-secondary"
              aria-label={`Remove ${it.name}`}
              title="Remove piece"
            >
              <Trash2 size={14} strokeWidth={1.25} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
