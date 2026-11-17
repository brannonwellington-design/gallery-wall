"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FIXTURE_KINDS, FIXTURE_PRESETS, fixtureLabel, isOnFloor } from "@/lib/fixtures";
import type { Fixture, FixtureKind, Room } from "@/lib/types";
import { toInput, toMm } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  room: Room;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: FixtureKind) => void;
  onUpdate: (id: string, patch: Partial<Fixture>) => void;
  onRemove: (id: string) => void;
};

/**
 * "Room" section of the sidebar: furniture, openings and electrical on the
 * wall, so the art can be planned around them.
 */
export default function FixturesPanel({ room, selectedId, onSelect, onAdd, onUpdate, onRemove }: Props) {
  const fixtures = room.fixtures ?? [];
  const selected = fixtures.find((f) => f.id === selectedId) ?? null;

  return (
    <section className="border-t border-surface-tertiary px-6 py-5 flex flex-col gap-3">
      <div>
        <div className="text-caption text-content-disabled mb-0.5">Room</div>
        <h2 className="text-lead text-content-primary">Furniture &amp; fixtures</h2>
        <p className="text-caption text-content-disabled mt-1">
          Add what&apos;s on or in front of the wall. Art snaps 8″ above furniture and Randomize works around everything.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Add a fixture">
        {FIXTURE_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-label"
            onClick={() => onAdd(kind)}
          >
            <Plus size={12} strokeWidth={1.25} aria-hidden="true" />
            {FIXTURE_PRESETS[kind].label}
          </Button>
        ))}
      </div>

      {fixtures.length > 0 ? (
        <ul className="flex flex-col">
          {fixtures.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                aria-pressed={f.id === selectedId}
                className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-label ${
                  f.id === selectedId
                    ? "bg-surface-brand-secondary text-content-brand"
                    : "text-content-primary hover:bg-surface-secondary"
                }`}
              >
                <span className="truncate">{fixtureLabel(f)}</span>
                <span className="shrink-0 text-caption text-content-disabled tabular">
                  {toInput(f.width, room.unit, 1)} × {toInput(f.height, room.unit, 1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <FixtureEditor
          key={selected.id}
          fixture={selected}
          room={room}
          onUpdate={(patch) => onUpdate(selected.id, patch)}
          onRemove={() => onRemove(selected.id)}
        />
      ) : null}
    </section>
  );
}

function FixtureEditor({
  fixture,
  room,
  onUpdate,
  onRemove,
}: {
  fixture: Fixture;
  room: Room;
  onUpdate: (patch: Partial<Fixture>) => void;
  onRemove: () => void;
}) {
  const unit = room.unit;
  const u = unit === "in" ? "″" : "cm";
  const read = () => ({
    label: fixture.label ?? "",
    width: toInput(fixture.width, unit),
    height: toInput(fixture.height, unit),
    left: toInput(fixture.x, unit),
    bottom: toInput(room.wallHeight - fixture.y - fixture.height, unit),
  });
  const [form, setForm] = useState(read);

  // Re-sync when the fixture moves on the canvas.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(read());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.x, fixture.y, fixture.width, fixture.height, fixture.label, unit]);

  function commit() {
    const width = Number(form.width);
    const height = Number(form.height);
    const left = Number(form.left);
    const bottom = Number(form.bottom);
    if (!(width > 0) || !(height > 0) || !(left >= 0) || !(bottom >= 0)) {
      setForm(read());
      return;
    }
    const h = toMm(height, unit);
    onUpdate({
      label: form.label.trim() || undefined,
      width: toMm(width, unit),
      height: h,
      x: toMm(left, unit),
      y: room.wallHeight - toMm(bottom, unit) - h,
    });
  }

  const field = (key: keyof typeof form, label: string, opts: { disabled?: boolean; text?: boolean } = {}) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`fx-${key}-${fixture.id}`}>{label}</Label>
      <Input
        id={`fx-${key}-${fixture.id}`}
        type={opts.text ? "text" : "number"}
        step="0.25"
        min="0"
        disabled={opts.disabled}
        placeholder={opts.text ? FIXTURE_PRESETS[fixture.kind].label : undefined}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-surface-tertiary bg-surface-highlight p-3">
      {field("label", "Name", { text: true })}
      <div className="grid grid-cols-2 gap-2">
        {field("width", `Width (${u})`)}
        {field("height", `Height (${u})`)}
        {field("left", `From left (${u})`)}
        {field("bottom", `Off the floor (${u})`, { disabled: isOnFloor(fixture) })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-label hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 size={12} strokeWidth={1.25} aria-hidden="true" />
        Remove
      </Button>
    </div>
  );
}
