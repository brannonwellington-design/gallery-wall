"use client";

import { useState } from "react";
import { hangerOf, outerSize } from "@/lib/geometry";
import type { Hanger, Item, Unit } from "@/lib/types";
import { toInput, toMm } from "@/lib/units";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Props = {
  item: Item;
  unit: Unit;
  onChange: (hanger: Hanger) => void;
};

/**
 * Hanging hardware for one piece: one hook or two, how far below the top
 * the nail sits, and (for two) how far apart. Feeds the hanging guide.
 */
export default function HangerFields({ item, unit, onChange }: Props) {
  const hanger = hangerOf(item);
  const unitLabel = unit === "in" ? '"' : "cm";
  const [drop, setDrop] = useState(() => toInput(hanger.drop, unit));
  const [spacing, setSpacing] = useState(() =>
    toInput(hanger.spacing || defaultSpacing(item), unit),
  );

  function save(next: Partial<Hanger>) {
    const { assumed, ...current } = hanger;
    void assumed;
    onChange({ ...current, ...next });
  }

  function commitDrop() {
    const v = Number(drop);
    if (v >= 0) save({ drop: toMm(v, unit) });
    else setDrop(toInput(hanger.drop, unit));
  }

  function commitSpacing() {
    const v = Number(spacing);
    if (v > 0) save({ spacing: toMm(v, unit) });
    else setSpacing(toInput(hanger.spacing || defaultSpacing(item), unit));
  }

  function setKind(kind: string) {
    if (kind !== "single" && kind !== "pair") return;
    save({
      kind,
      spacing: kind === "pair" ? hanger.spacing || defaultSpacing(item) : hanger.spacing,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Hanging</Label>
        <ToggleGroup
          type="single"
          value={hanger.kind}
          onValueChange={setKind}
          variant="outline"
          size="sm"
          aria-label="Hanger type"
        >
          <ToggleGroupItem value="single" className="px-2 text-label">
            One hook
          </ToggleGroupItem>
          <ToggleGroupItem value="pair" className="px-2 text-label">
            Two hooks
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`hang-drop-${item.id}`}>Nail below top ({unitLabel})</Label>
          <Input
            id={`hang-drop-${item.id}`}
            type="number"
            step="0.125"
            min="0"
            value={drop}
            onChange={(e) => setDrop(e.target.value)}
            onBlur={commitDrop}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        {hanger.kind === "pair" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`hang-spacing-${item.id}`}>Hooks apart ({unitLabel})</Label>
            <Input
              id={`hang-spacing-${item.id}`}
              type="number"
              step="0.125"
              min="0"
              value={spacing}
              onChange={(e) => setSpacing(e.target.value)}
              onBlur={commitSpacing}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        ) : null}
      </div>
      <p className="text-caption text-content-disabled">
        {hanger.assumed
          ? "Not measured yet — assuming picture wire with the nail 2″ below the top. Pull the wire taut toward the top and measure to its peak."
          : hanger.kind === "single"
            ? "Measured from the top of the frame to the wire's peak (or the sawtooth)."
            : "Measured from the top of the frame to the D-rings."}
      </p>
    </div>
  );
}

/** D-rings usually sit about a third in from each side. */
function defaultSpacing(item: Item): number {
  return Math.round(outerSize(item).width / 3);
}
