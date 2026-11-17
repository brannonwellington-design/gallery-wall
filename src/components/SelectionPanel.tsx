"use client";

import { useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Copy,
  Crosshair,
  Trash2,
  X,
} from "lucide-react";
import {
  alignItems,
  centerItemsAt,
  distributeItems,
  type AlignMode,
} from "@/lib/arrange";
import { isFurniture } from "@/lib/fixtures";
import type { Item, Room } from "@/lib/types";
import { toMm } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  room: Room;
  selectedIds: Set<string>;
  onArrange: (fn: (items: Item[]) => Item[]) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClear: () => void;
};

const ALIGN: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: "left", label: "Align left edges", Icon: AlignStartVertical },
  { mode: "hcenter", label: "Align centers (vertical line)", Icon: AlignCenterVertical },
  { mode: "right", label: "Align right edges", Icon: AlignEndVertical },
  { mode: "top", label: "Align top edges", Icon: AlignStartHorizontal },
  { mode: "vcenter", label: "Align middles (horizontal line)", Icon: AlignCenterHorizontal },
  { mode: "bottom", label: "Align bottom edges", Icon: AlignEndHorizontal },
];

/** Sidebar panel for two or more selected pieces: align, space, center. */
export default function SelectionPanel({
  room,
  selectedIds,
  onArrange,
  onDuplicate,
  onRemove,
  onClear,
}: Props) {
  const count = selectedIds.size;
  const unitLabel = room.unit === "in" ? '"' : "cm";
  const [gap, setGap] = useState(room.unit === "in" ? "3" : "7.5");
  const sofa = (room.fixtures ?? [])
    .filter(isFurniture)
    .sort((a, b) => b.width - a.width)[0];

  function exactGap(axis: "x" | "y") {
    const v = Number(gap);
    if (!(v >= 0)) return;
    onArrange((items) => distributeItems(items, selectedIds, axis, toMm(v, room.unit)));
  }

  return (
    <section className="flex flex-col gap-4 px-6 py-5 border-t border-surface-tertiary bg-surface-highlight">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-caption text-content-disabled mb-0.5">Selection</div>
          <h3 className="text-lead text-content-primary">{count} pieces</h3>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="Clear selection">
              <X size={14} strokeWidth={1.25} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear selection (Esc)</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Align</Label>
        <div className="flex gap-1" role="group" aria-label="Align">
          {ALIGN.map(({ mode, label, Icon }) => (
            <IconAction key={mode} label={label} onClick={() => onArrange((items) => alignItems(items, selectedIds, mode))}>
              <Icon size={16} strokeWidth={1.25} aria-hidden="true" />
            </IconAction>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Space evenly</Label>
        <div className="flex gap-1">
          <IconAction
            label={count < 3 ? "Select 3+ pieces to space evenly" : "Equal gaps left to right"}
            disabled={count < 3}
            onClick={() => onArrange((items) => distributeItems(items, selectedIds, "x"))}
          >
            <AlignHorizontalSpaceAround size={16} strokeWidth={1.25} aria-hidden="true" />
          </IconAction>
          <IconAction
            label={count < 3 ? "Select 3+ pieces to space evenly" : "Equal gaps top to bottom"}
            disabled={count < 3}
            onClick={() => onArrange((items) => distributeItems(items, selectedIds, "y"))}
          >
            <AlignVerticalSpaceAround size={16} strokeWidth={1.25} aria-hidden="true" />
          </IconAction>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exact-gap">Exact gap ({unitLabel})</Label>
        <div className="flex gap-1.5">
          <Input
            id="exact-gap"
            type="number"
            step="0.25"
            min="0"
            className="w-20"
            value={gap}
            onChange={(e) => setGap(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" className="h-8 text-label" onClick={() => exactGap("x")}>
            Across
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-label" onClick={() => exactGap("y")}>
            Down
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-label"
          onClick={() => onArrange((items) => centerItemsAt(items, selectedIds, room.wallWidth / 2))}
        >
          <Crosshair size={14} strokeWidth={1.25} aria-hidden="true" />
          Center on wall
        </Button>
        {sofa ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-label"
            onClick={() => onArrange((items) => centerItemsAt(items, selectedIds, sofa.x + sofa.width / 2))}
          >
            <Crosshair size={14} strokeWidth={1.25} aria-hidden="true" />
            Center over {sofa.label?.trim() || "furniture"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="h-8 text-label" onClick={onDuplicate}>
          <Copy size={14} strokeWidth={1.25} aria-hidden="true" />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-label hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 size={14} strokeWidth={1.25} aria-hidden="true" />
          Remove {count}
        </Button>
      </div>

      <p className="text-caption text-content-disabled">
        Shift-click pieces to add or remove them. Drag any selected piece to move them together; arrow keys nudge.
      </p>
    </section>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span keeps the tooltip working on disabled buttons */}
        <span>
          <Button type="button" variant="outline" size="icon" onClick={onClick} disabled={disabled} aria-label={label}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
