"use client";

import { useRef, useState } from "react";
import type { Frame, Unit } from "@/lib/types";
import { toMm } from "@/lib/units";

type Props = {
  unit: Unit;
  onAdd: (data: {
    name: string;
    imageDataUrl: string;
    artWidth: number;
    artHeight: number;
    frame: Frame | null;
  }) => void;
};

const DEFAULT_FRAME_COLOR = "#1f1f1f";

export default function AddItemForm({ unit, onAdd }: Props) {
  const [name, setName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [width, setWidth] = useState("18");
  const [height, setHeight] = useState("24");
  const [framed, setFramed] = useState(true);
  const [matIn, setMatIn] = useState("2");
  const [frameIn, setFrameIn] = useState("0.75");
  const [frameColor, setFrameColor] = useState(DEFAULT_FRAME_COLOR);
  const fileInput = useRef<HTMLInputElement>(null);

  const unitLabel = unit === "in" ? '"' : "cm";

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        setImageRatio(probe.width / probe.height);
      };
      probe.src = dataUrl;
      setImageDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function syncHeightFromWidth(nextWidth: string) {
    setWidth(nextWidth);
    const w = Number(nextWidth);
    if (imageRatio && w > 0) {
      setHeight((w / imageRatio).toFixed(2));
    }
  }

  function reset() {
    setName("");
    setImageDataUrl(null);
    setImageRatio(null);
    setWidth("18");
    setHeight("24");
    setFramed(true);
    setMatIn("2");
    setFrameIn("0.75");
    setFrameColor(DEFAULT_FRAME_COLOR);
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit() {
    if (!imageDataUrl) return;
    const w = Number(width);
    const h = Number(height);
    if (!(w > 0) || !(h > 0)) return;
    const frame: Frame | null = framed
      ? {
          matWidth: toMm(Number(matIn) || 0, unit),
          frameWidth: toMm(Number(frameIn) || 0, unit),
          frameColor,
        }
      : null;
    onAdd({
      name: name.trim() || "Untitled",
      imageDataUrl,
      artWidth: toMm(w, unit),
      artHeight: toMm(h, unit),
      frame,
    });
    reset();
  }

  return (
    <div className="flex flex-col gap-3 p-4 border-t border-zinc-200">
      <h2 className="text-sm font-semibold text-zinc-700">Add a piece</h2>

      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Image
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-xs"
        />
      </label>

      {imageDataUrl && (
        <div className="border border-zinc-200 rounded p-2 bg-zinc-50 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt="preview" className="max-h-24" />
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-zinc-600">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunset print"
          className="border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Art width ({unitLabel})
          <input
            type="number"
            step="0.1"
            min="0"
            value={width}
            onChange={(e) => syncHeightFromWidth(e.target.value)}
            className="border border-zinc-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Art height ({unitLabel})
          <input
            type="number"
            step="0.1"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="border border-zinc-300 rounded px-2 py-1 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-700 select-none">
        <input
          type="checkbox"
          checked={framed}
          onChange={(e) => setFramed(e.target.checked)}
        />
        Add a frame
      </label>

      {framed && (
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Mat ({unitLabel})
            <input
              type="number"
              step="0.1"
              min="0"
              value={matIn}
              onChange={(e) => setMatIn(e.target.value)}
              className="border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Frame ({unitLabel})
            <input
              type="number"
              step="0.1"
              min="0"
              value={frameIn}
              onChange={(e) => setFrameIn(e.target.value)}
              className="border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            Color
            <input
              type="color"
              value={frameColor}
              onChange={(e) => setFrameColor(e.target.value)}
              className="border border-zinc-300 rounded h-[30px] w-full"
            />
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!imageDataUrl}
        className="bg-zinc-900 text-white rounded px-3 py-1.5 text-sm font-medium disabled:bg-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
      >
        Add to wall
      </button>
    </div>
  );
}
