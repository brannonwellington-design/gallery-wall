"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Pin, PinOff, X } from "lucide-react";
import type { Frame, Item, Unit } from "@/lib/types";
import { DEFAULT_FRAME } from "@/lib/defaults";
import { fromMm, toInput, toMm } from "@/lib/units";
import { downscaleImage } from "@/lib/image";
import HangerFields from "./HangerFields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  item: Item;
  unit: Unit;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onTogglePin: () => void;
  onClose: () => void;
};


export default function EditItemPanel({
  item,
  unit,
  onUpdate,
  onTogglePin,
  onClose,
}: Props) {
  const unitLabel = unit === "in" ? '"' : "cm";

  const [name, setName] = useState(item.name);
  const [width, setWidth] = useState(() => fromMm(item.artWidth, unit).toFixed(1));
  const [height, setHeight] = useState(() =>
    fromMm(item.artHeight, unit).toFixed(1),
  );
  const [matInput, setMatInput] = useState(() =>
    toInput(item.frame?.matWidth ?? DEFAULT_FRAME.matWidth, unit),
  );
  const [frameInput, setFrameInput] = useState(() =>
    toInput(item.frame?.frameWidth ?? DEFAULT_FRAME.frameWidth, unit),
  );
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(item.name);
    setWidth(fromMm(item.artWidth, unit).toFixed(1));
    setHeight(fromMm(item.artHeight, unit).toFixed(1));
    if (item.frame) {
      setMatInput(toInput(item.frame.matWidth, unit));
      setFrameInput(toInput(item.frame.frameWidth, unit));
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
        ...DEFAULT_FRAME,
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
      imageSrc: downsized,
      imageOriginalSrc: null,
      artWidthOriginal: null,
      artHeightOriginal: null,
    });
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5 border-t border-surface-tertiary bg-surface-highlight">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-caption text-content-disabled mb-0.5">
            Editing
          </div>
          <div className="text-body text-content-primary truncate max-w-[200px]">
            {item.name}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close edit panel"
            >
              <X size={14} strokeWidth={1.25} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Done editing</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageSrc}
          alt=""
          className="w-16 h-16 object-cover rounded-sm border border-surface-tertiary bg-surface-primary"
        />
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-label"
          onClick={() => fileInput.current?.click()}
        >
          Replace image
        </Button>
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={!!item.pinned}
            onPressedChange={onTogglePin}
            className="self-start px-3 text-label"
            aria-label={item.pinned ? "Unpin piece" : "Pin position"}
          >
            {item.pinned ? (
              <PinOff size={14} strokeWidth={1.25} aria-hidden="true" />
            ) : (
              <Pin size={14} strokeWidth={1.25} aria-hidden="true" />
            )}
            {item.pinned ? "Pinned" : "Pin position"}
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          {item.pinned
            ? "Unpin — Randomize will move this piece"
            : "Pin — keep this piece in place when randomizing"}
        </TooltipContent>
      </Tooltip>

      <Field label="Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={swapDims}
              aria-label="Swap width and height"
            >
              <ArrowLeftRight size={14} strokeWidth={1.25} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Swap width and height</TooltipContent>
        </Tooltip>
        <Field label={`Height (${unitLabel})`}>
          <NumberInput
            value={height}
            onChange={setHeight}
            onCommit={commitDims}
            ariaLabel="Height"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="edit-add-frame"
          checked={!!item.frame}
          onCheckedChange={() => toggleFrame()}
        />
        <Label
          htmlFor="edit-add-frame"
          className="text-label text-content-primary cursor-pointer"
        >
          Add a frame
        </Label>
      </div>

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

      <HangerFields
        item={item}
        unit={unit}
        onChange={(hanger) => onUpdate(item.id, { hanger })}
      />
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
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
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
    <Input
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
