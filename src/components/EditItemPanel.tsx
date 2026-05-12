"use client";

import { useEffect, useRef, useState } from "react";
import type { Frame, Item, Unit } from "@/lib/types";
import { fromMm, toMm } from "@/lib/units";
import { downscaleImage } from "@/lib/image";

type Props = {
  item: Item;
  unit: Unit;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onClose: () => void;
};

const DEFAULT_FRAME_COLOR = "#1f1f1f";

export default function EditItemPanel({ item, unit, onUpdate, onClose }: Props) {
  const unitLabel = unit === "in" ? '"' : "cm";

  const [name, setName] = useState(item.name);
  const [width, setWidth] = useState(() =>
    fromMm(item.artWidth, unit).toFixed(1),
  );
  const [height, setHeight] = useState(() =>
    fromMm(item.artHeight, unit).toFixed(1),
  );
  const [matInput, setMatInput] = useState(() =>
    item.frame ? fromMm(item.frame.matWidth, unit).toFixed(2) : "2",
  );
  const [frameInput, setFrameInput] = useState(() =>
    item.frame ? fromMm(item.frame.frameWidth, unit).toFixed(2) : "0.75",
  );
  const fileInput = useRef<HTMLInputElement>(null);

  // Sync local inputs when the selected item, its values, or the unit changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(item.name);
    setWidth(fromMm(item.artWidth, unit).toFixed(1));
    setHeight(fromMm(item.artHeight, unit).toFixed(1));
    if (item.frame) {
      setMatInput(fromMm(item.frame.matWidth, unit).toFixed(2));
      setFrameInput(fromMm(item.frame.frameWidth, unit).toFixed(2));
    }
  }, [
    item.id,
    item.name,
    item.artWidth,
    item.artHeight,
    item.frame,
    unit,
  ]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== item.name) {
      onUpdate(item.id, { name: trimmed });
    } else {
      setName(item.name);
    }
  }

  function commitDims() {
    const w = Number(width);
    const h = Number(height);
    if (w > 0 && h > 0) {
      const newW = toMm(w, unit);
      const newH = toMm(h, unit);
      if (newW !== item.artWidth || newH !== item.artHeight) {
        onUpdate(item.id, { artWidth: newW, artHeight: newH });
      }
    } else {
      setWidth(fromMm(item.artWidth, unit).toFixed(1));
      setHeight(fromMm(item.artHeight, unit).toFixed(1));
    }
  }

  function toggleFrame() {
    if (item.frame) {
      onUpdate(item.id, { frame: null });
    } else {
      const defaultFrame: Frame = {
        matWidth: toMm(2, "in"),
        frameWidth: toMm(0.75, "in"),
        frameColor: DEFAULT_FRAME_COLOR,
      };
      onUpdate(item.id, { frame: defaultFrame });
    }
  }

  function commitFrameDims() {
    if (!item.frame) return;
    const newMat = toMm(Number(matInput) || 0, unit);
    const newFrame = toMm(Number(frameInput) || 0, unit);
    if (
      newMat !== item.frame.matWidth ||
      newFrame !== item.frame.frameWidth
    ) {
      onUpdate(item.id, {
        frame: { ...item.frame, matWidth: newMat, frameWidth: newFrame },
      });
    }
  }

  function setFrameColor(color: string) {
    if (!item.frame) return;
    onUpdate(item.id, { frame: { ...item.frame, frameColor: color } });
  }

  function swapDims() {
    onUpdate(item.id, {
      artWidth: item.artHeight,
      artHeight: item.artWidth,
    });
  }

  async function handleReplaceImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    const raw = await readAsDataUrl(file);
    const downsized = await downscaleImage(raw);
    // New image invalidates the background-removed snapshot and any
    // pre-crop dimensions stashed alongside it.
    onUpdate(item.id, {
      imageDataUrl: downsized,
      imageOriginalDataUrl: null,
      artWidthOriginal: null,
      artHeightOriginal: null,
    });
  }

  return (
    <div className="flex flex-col gap-3 p-4 border-t border-zinc-200 bg-blue-50/40">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">Edit piece</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-0.5 rounded hover:bg-white"
        >
          Done
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageDataUrl}
          alt=""
          className="w-16 h-16 object-cover rounded border border-zinc-200 bg-white"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="text-xs text-zinc-700 underline hover:text-zinc-900"
        >
          Replace image
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleReplaceImage(f);
          }}
          className="hidden"
        />
      </div>

      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Width ({unitLabel})
          <input
            type="number"
            step="0.1"
            min="0"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onBlur={commitDims}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="border border-zinc-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={swapDims}
          title="Swap width and height"
          className="border border-zinc-300 rounded text-xs px-2 py-1 hover:bg-white"
        >
          ⇄
        </button>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Height ({unitLabel})
          <input
            type="number"
            step="0.1"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onBlur={commitDims}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="border border-zinc-300 rounded px-2 py-1 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-700 select-none">
        <input
          type="checkbox"
          checked={!!item.frame}
          onChange={toggleFrame}
        />
        Add a frame
      </label>

      {item.frame && (
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Mat ({unitLabel})
            <input
              type="number"
              step="0.1"
              min="0"
              value={matInput}
              onChange={(e) => setMatInput(e.target.value)}
              onBlur={commitFrameDims}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Frame ({unitLabel})
            <input
              type="number"
              step="0.1"
              min="0"
              value={frameInput}
              onChange={(e) => setFrameInput(e.target.value)}
              onBlur={commitFrameDims}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Color
            <input
              type="color"
              value={item.frame.frameColor}
              onChange={(e) => setFrameColor(e.target.value)}
              className="border border-zinc-300 rounded h-[30px] w-full"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
