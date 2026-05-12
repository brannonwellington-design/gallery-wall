"use client";

import { useEffect, useRef, useState } from "react";
import type { Frame, Unit } from "@/lib/types";
import { toMm } from "@/lib/units";
import { downscaleImage } from "@/lib/image";

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

type Variant = {
  widthInches: number;
  heightInches: number;
  label: string | null;
};

type ExtractedPayload = {
  name: string | null;
  widthInches: number | null;
  heightInches: number | null;
  variants: Variant[];
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

type ExtractionState = {
  confidence: "high" | "medium" | "low";
  warnings: string[];
  variants: Variant[];
} | null;

function inchesToInput(inches: number, unit: Unit): string {
  return unit === "in" ? inches.toFixed(1) : (inches * 2.54).toFixed(1);
}

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
  const formRef = useRef<HTMLDivElement>(null);

  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionState>(null);
  const [dragOver, setDragOver] = useState(false);

  const unitLabel = unit === "in" ? '"' : "cm";

  function setImageDataUrlWithProbe(dataUrl: string) {
    setImageDataUrl(dataUrl);
    const probe = new Image();
    probe.onload = () => setImageRatio(probe.width / probe.height);
    probe.src = dataUrl;
  }

  // Paste-from-clipboard handler, scoped to the form.
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleUserImage(file);
            return;
          }
        }
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
    // handleUserImage is stable from the form's perspective; we attach once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyExtraction(e: ExtractedPayload) {
    if (e.name) setName(e.name);
    if (e.widthInches != null) setWidth(inchesToInput(e.widthInches, unit));
    if (e.heightInches != null) setHeight(inchesToInput(e.heightInches, unit));
    setExtraction({
      confidence: e.confidence,
      warnings: e.warnings ?? [],
      variants: e.variants ?? [],
    });
  }

  function applyVariant(v: Variant) {
    setWidth(inchesToInput(v.widthInches, unit));
    setHeight(inchesToInput(v.heightInches, unit));
  }

  async function fetchFromUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setFetching(true);
    setFetchError(null);
    setExtraction(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        extracted?: ExtractedPayload & { imageUrl: string | null };
        imageDataUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.extracted) {
        throw new Error(data.error || `Fetch failed (${res.status})`);
      }
      if (data.imageDataUrl) {
        const small = await downscaleImage(data.imageDataUrl);
        setImageDataUrlWithProbe(small);
      }
      applyExtraction(data.extracted);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to extract");
    } finally {
      setFetching(false);
    }
  }

  async function handleUserImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    const rawDataUrl = await readAsDataUrl(file);
    // Downscale once, then use the same compact image for wall storage and
    // vision extraction. Keeps PATCH bodies under Vercel's limit and
    // halves the vision token bill.
    const dataUrl = await downscaleImage(rawDataUrl);
    setImageDataUrlWithProbe(dataUrl);
    setFetching(true);
    setFetchError(null);
    setExtraction(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = (await res.json()) as {
        extracted?: ExtractedPayload;
        error?: string;
      };
      if (!res.ok || !data.extracted) {
        throw new Error(data.error || `Extraction failed (${res.status})`);
      }
      applyExtraction(data.extracted);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to extract");
    } finally {
      setFetching(false);
    }
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
    setUrlInput("");
    setExtraction(null);
    setFetchError(null);
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

  function onDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUserImage(file);
  }

  return (
    <div
      ref={formRef}
      className="flex flex-col gap-3 p-4 border-t border-zinc-200"
      onDragEnter={(e) => {
        e.preventDefault();
        if (Array.from(e.dataTransfer.types).includes("Files")) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (Array.from(e.dataTransfer.types).includes("Files")) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <h2 className="text-sm font-semibold text-zinc-700">Add a piece</h2>

      {/* URL paste */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600">Paste product URL</label>
        <div className="flex gap-1">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void fetchFromUrl();
              }
            }}
            placeholder="https://..."
            className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm min-w-0"
          />
          <button
            type="button"
            onClick={() => void fetchFromUrl()}
            disabled={!urlInput || fetching}
            className="bg-zinc-100 border border-zinc-300 rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            {fetching ? "Working…" : "Fetch"}
          </button>
        </div>
      </div>

      <div className="text-xs text-zinc-400 text-center">— or —</div>

      {/* Drop zone */}
      <div
        onClick={() => fileInput.current?.click()}
        className={`border-2 border-dashed rounded p-4 text-center text-xs cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50"
        }`}
      >
        {imageDataUrl ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageDataUrl} alt="preview" className="max-h-24" />
            <span className="text-zinc-500">Click to replace, or drop another image</span>
          </div>
        ) : (
          <>
            <div className="font-medium text-zinc-700 mb-1">
              Drop a screenshot, paste with ⌘V, or click to choose
            </div>
            <div className="text-zinc-500">
              Works on bot-blocked sites (West Elm, Pottery Barn, …) — screenshot the page in your
              browser, drop it here, and Claude reads the dimensions from the image.
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUserImage(f);
          }}
          className="hidden"
        />
      </div>

      {/* Extraction status */}
      {fetchError && (
        <p className="text-xs text-red-600 break-words">{fetchError}</p>
      )}
      {extraction && (
        <div className="text-xs flex flex-col gap-1">
          <p
            className={
              extraction.confidence === "high"
                ? "text-green-700"
                : extraction.confidence === "medium"
                  ? "text-amber-700"
                  : "text-zinc-600"
            }
          >
            {extraction.confidence === "high"
              ? "Extracted with high confidence — review and add."
              : extraction.confidence === "medium"
                ? "Extracted — please double-check the dimensions."
                : "Couldn't confidently extract dimensions — enter them manually."}
          </p>
          {extraction.warnings.map((w, i) => (
            <p key={i} className="text-zinc-600">
              • {w}
            </p>
          ))}
          {extraction.variants.length > 0 && (
            <div className="mt-1">
              <p className="text-zinc-600">Sizes available — pick one:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {extraction.variants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyVariant(v)}
                    className="border border-zinc-300 rounded px-2 py-1 text-xs hover:bg-zinc-50"
                  >
                    {v.widthInches}″ × {v.heightInches}″
                    {v.label ? ` — ${v.label}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
