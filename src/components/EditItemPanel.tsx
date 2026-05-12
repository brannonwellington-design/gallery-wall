"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
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
  const [width, setWidth] = useState(() => fromMm(item.artWidth, unit).toFixed(1));
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(item.name);
    setWidth(fromMm(item.artWidth, unit).toFixed(1));
    setHeight(fromMm(item.artHeight, unit).toFixed(1));
    if (item.frame) {
      setMatInput(fromMm(item.frame.matWidth, unit).toFixed(2));
      setFrameInput(fromMm(item.frame.frameWidth, unit).toFixed(2));
    }
  }, [item.id, item.name, item.artWidth, item.artHeight, item.frame, unit]);

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
    onUpdate(item.id, {
      imageDataUrl: downsized,
      imageOriginalDataUrl: null,
      artWidthOriginal: null,
      artHeightOriginal: null,
    });
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5 border-t border-surface-tertiary bg-surface-highlight">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] leading-4 text-content-disabled mb-0.5">
            Editing
          </div>
          <div className="text-[14px] leading-5 text-content-primary truncate max-w-[200px]">
            {item.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-content-secondary hover:text-content-primary hover:bg-surface-secondary"
          aria-label="Close edit panel"
          title="Done editing"
        >
          <X size={14} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageDataUrl}
          alt=""
          className="w-16 h-16 object-cover rounded-sm border border-surface-tertiary bg-surface-primary"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="text-[12px] leading-4 text-content-brand underline-offset-2 hover:underline"
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

      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 px-2 border border-surface-tertiary rounded-md text-[14px] leading-5 text-content-primary bg-surface-primary"
        />
      </Field>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Field label={`Width (${unitLabel})`}>
          <NumberInput
            value={width}
            onChange={setWidth}
            onCommit={commitDims}
            ariaLabel="Width"
          />
        </Field>
        <button
          type="button"
          onClick={swapDims}
          title="Swap width and height"
          aria-label="Swap width and height"
          className="inline-flex items-center justify-center h-8 w-8 mb-0 border border-surface-tertiary rounded-md text-content-secondary hover:text-content-primary hover:bg-surface-secondary"
        >
          <ArrowLeftRight size={14} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <Field label={`Height (${unitLabel})`}>
          <NumberInput
            value={height}
            onChange={setHeight}
            onCommit={commitDims}
            ariaLabel="Height"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-[12px] leading-4 text-content-primary select-none cursor-pointer">
        <input
          type="checkbox"
          checked={!!item.frame}
          onChange={toggleFrame}
          className="w-4 h-4 accent-[color:var(--content-brand)]"
        />
        Add a frame
      </label>

      {item.frame && (
        <div className="grid grid-cols-3 gap-2">
          <Field label={`Mat (${unitLabel})`}>
            <NumberInput
              value={matInput}
              onChange={setMatInput}
              onCommit={commitFrameDims}
              ariaLabel="Mat width"
            />
          </Field>
          <Field label={`Frame (${unitLabel})`}>
            <NumberInput
              value={frameInput}
              onChange={setFrameInput}
              onCommit={commitFrameDims}
              ariaLabel="Frame width"
            />
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={item.frame.frameColor}
              onChange={(e) => setFrameColor(e.target.value)}
              aria-label="Frame color"
              className="h-8 w-full border border-surface-tertiary rounded-md bg-surface-primary"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] leading-4 text-content-disabled">
      {label}
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  onCommit,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      step="0.1"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={ariaLabel}
      className="h-8 px-2 border border-surface-tertiary rounded-md text-[14px] leading-5 text-content-primary bg-surface-primary tabular"
    />
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
