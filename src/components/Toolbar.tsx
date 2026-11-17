"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileDown, Redo2, Ruler, Shuffle, Trash2, Undo2 } from "lucide-react";
import { formatAbsolute, formatEditedLabel } from "@/lib/dates";
import type { Unit } from "@/lib/types";
import { fromMm, toMm } from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SaveStatus } from "@/lib/useRoomAutosave";

export type { SaveStatus };

type Props = {
  roomName: string;
  unit: Unit;
  wallWidthMm: number;
  wallHeightMm: number;
  snapEnabled: boolean;
  redlinesEnabled: boolean;
  eyeLineEnabled: boolean;
  eyeLineHeightMm: number;
  saveStatus: SaveStatus;
  saveError?: string | null;
  onRetrySave?: () => void;
  lastEditedAt?: string | null;
  onChangeName: (name: string) => void;
  onChangeUnit: (unit: Unit) => void;
  onChangeWall: (widthMm: number, heightMm: number) => void;
  onChangeSnap: (enabled: boolean) => void;
  onChangeRedlines: (enabled: boolean) => void;
  onChangeEyeLineEnabled: (enabled: boolean) => void;
  onChangeEyeLineHeight: (heightMm: number) => void;
  onRandomize: () => void;
  layoutStatus: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onClear: () => void;
  /** Link to this room's printable hanging guide. */
  guideHref: string;
  /** Who else is in the room (rendered next to the save status). */
  presence?: React.ReactNode;
};

export default function Toolbar({
  roomName,
  unit,
  wallWidthMm,
  wallHeightMm,
  snapEnabled,
  redlinesEnabled,
  eyeLineEnabled,
  eyeLineHeightMm,
  saveStatus,
  saveError = null,
  onRetrySave,
  lastEditedAt = null,
  onChangeName,
  onChangeUnit,
  onChangeWall,
  onChangeSnap,
  onChangeRedlines,
  onChangeEyeLineEnabled,
  onChangeEyeLineHeight,
  onRandomize,
  layoutStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPNG,
  onExportPDF,
  onClear,
  guideHref,
  presence,
}: Props) {
  const [wInput, setWInput] = useState(() => fromMm(wallWidthMm, unit).toFixed(1));
  const [hInput, setHInput] = useState(() => fromMm(wallHeightMm, unit).toFixed(1));
  const [eyeInput, setEyeInput] = useState(() =>
    fromMm(eyeLineHeightMm, unit).toFixed(1),
  );
  const [nameInput, setNameInput] = useState(roomName);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWInput(fromMm(wallWidthMm, unit).toFixed(1));
    setHInput(fromMm(wallHeightMm, unit).toFixed(1));
    setEyeInput(fromMm(eyeLineHeightMm, unit).toFixed(1));
  }, [wallWidthMm, wallHeightMm, eyeLineHeightMm, unit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNameInput(roomName);
  }, [roomName]);

  function commitWall() {
    const w = Number(wInput);
    const h = Number(hInput);
    if (w > 0 && h > 0) onChangeWall(toMm(w, unit), toMm(h, unit));
  }

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== roomName) onChangeName(trimmed);
    else setNameInput(roomName);
  }

  function commitEyeLine() {
    const v = Number(eyeInput);
    if (v > 0) onChangeEyeLineHeight(toMm(v, unit));
    else setEyeInput(fromMm(eyeLineHeightMm, unit).toFixed(1));
  }

  return (
    <header className="border-b border-surface-tertiary bg-surface-primary">
      {/* Identity + file. pr-14 clears the fixed ThemeToggle (top-4 right-4). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2 pr-14">
        <Hint label="Back to rooms">
          <Button variant="ghost" className="-ml-2 text-label" asChild>
            <Link href="/">
              <ArrowLeft size={14} strokeWidth={1} aria-hidden="true" />
              Rooms
            </Link>
          </Button>
        </Hint>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-label text-content-secondary shrink-0 select-none">
            Listen Labs /
          </span>
          <Input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 w-48 min-w-0 border-transparent bg-transparent text-lead hover:border-border"
            aria-label="Room name"
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <SaveIndicator
            status={saveStatus}
            error={saveError}
            onRetry={onRetrySave}
          />
          {lastEditedAt ? (
            <Hint label={formatAbsolute(lastEditedAt)}>
              <span className="text-label text-content-disabled tabular hidden sm:inline">
                {formatEditedLabel(lastEditedAt)}
              </span>
            </Hint>
          ) : null}
        </div>

        <div className="flex-1 min-w-2" />

        {presence}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="text-label"
            onClick={onExportPNG}
          >
            <Download size={14} strokeWidth={1} aria-hidden="true" />
            PNG
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-label"
            onClick={onExportPDF}
          >
            <FileDown size={14} strokeWidth={1} aria-hidden="true" />
            PDF
          </Button>
          <Hint label="Printable guide: where every nail goes, measured from the left edge and the floor">
            <Button variant="ghost" className="text-label" asChild>
              <Link href={guideHref} target="_blank" rel="noopener">
                <Ruler size={14} strokeWidth={1} aria-hidden="true" />
                Hanging guide
              </Link>
            </Button>
          </Hint>
          <Hint label="Clear wall">
            <Button
              type="button"
              variant="ghost"
              className="text-label hover:bg-destructive/10 hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 size={14} strokeWidth={1} aria-hidden="true" />
              Clear
            </Button>
          </Hint>
        </div>
      </div>

      {/* Wall, guides, layout — grouped by whitespace, not hairlines. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2 bg-surface-highlight border-t border-surface-tertiary">
        <div className="flex items-center gap-2">
          <span className="text-caption text-content-disabled">Wall</span>
          <NumInput value={wInput} onChange={setWInput} onCommit={commitWall} ariaLabel="Wall width" />
          <span className="text-label text-content-disabled">×</span>
          <NumInput value={hInput} onChange={setHInput} onCommit={commitWall} ariaLabel="Wall height" />
          <UnitToggle unit={unit} onChange={onChangeUnit} />
        </div>

        <div className="flex items-center gap-1">
          <Hint label="Toggle snap (hold Alt to disable while dragging)">
            <Toggle
              pressed={snapEnabled}
              onPressedChange={onChangeSnap}
              className="px-3 text-label"
              aria-label="Snap"
            >
              Snap
            </Toggle>
          </Hint>
          <Hint label="Show spacing between pieces and to the wall edges">
            <Toggle
              pressed={redlinesEnabled}
              onPressedChange={onChangeRedlines}
              className="px-3 text-label"
              aria-label="Redlines"
            >
              Redlines
            </Toggle>
          </Hint>
          <Hint label={`Toggle the 57" gallery eye line`}>
            <Toggle
              pressed={eyeLineEnabled}
              onPressedChange={onChangeEyeLineEnabled}
              className="px-3 text-label"
              aria-label="Eye line"
            >
              Eye line
            </Toggle>
          </Hint>
          <NumInput
            value={eyeInput}
            onChange={setEyeInput}
            onCommit={commitEyeLine}
            disabled={!eyeLineEnabled}
            ariaLabel="Eye line height from floor"
          />
        </div>

        <div className="flex items-center gap-2">
          <Hint label="Randomize layout — re-arrange unpinned pieces using a classic gallery pattern">
            <Button
              type="button"
              variant="ghost"
              className="text-label"
              onClick={onRandomize}
            >
              <Shuffle size={14} strokeWidth={1} aria-hidden="true" />
              Randomize
            </Button>
          </Hint>
          {layoutStatus ? (
            <span
              className="text-caption text-content-secondary"
              aria-live="polite"
            >
              {layoutStatus}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-2" />

        <div className="flex items-center">
          <Hint label="Undo (⌘Z)">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <Undo2 size={14} strokeWidth={1} aria-hidden="true" />
            </Button>
          </Hint>
          <Hint label="Redo (⇧⌘Z)">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
            >
              <Redo2 size={14} strokeWidth={1} aria-hidden="true" />
            </Button>
          </Hint>
        </div>
      </div>
    </header>
  );
}

function Hint({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function NumInput({
  value,
  onChange,
  onCommit,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      step="0.5"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-20"
    />
  );
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: Unit;
  onChange: (u: Unit) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={unit}
      onValueChange={(v) => {
        if (v === "in" || v === "cm") onChange(v);
      }}
      variant="outline"
      spacing={0}
      className="overflow-hidden border border-border"
      aria-label="Units"
    >
      {(["in", "cm"] as const).map((u) => (
        <ToggleGroupItem
          key={u}
          value={u}
          className="rounded-none text-label data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {u}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SaveIndicator({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (status === "idle") return <span className="min-w-[56px]" />;

  const text =
    status === "saving"
      ? "Saving…"
      : status === "unsaved"
        ? "Unsaved"
        : status === "saved"
          ? "Saved"
          : status === "error"
            ? "Save failed"
            : status === "conflict"
              ? "Out of date"
              : "";
  const variant =
    status === "error" || status === "conflict"
      ? "destructive"
      : status === "unsaved"
        ? "secondary"
        : "ghost";
  const title =
    status === "error" || status === "conflict"
      ? error || "Save failed — click to retry"
      : status === "saved" && error
        ? error
        : undefined;

  const badge = (
    <Badge variant={variant} className="min-w-[56px] justify-start" aria-live="polite">
      {text}
    </Badge>
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      {title ? <Hint label={title}>{badge}</Hint> : badge}
      {(status === "error" || status === "conflict") && onRetry ? (
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-label text-destructive"
          onClick={onRetry}
        >
          {status === "conflict" ? "Reload" : "Retry"}
        </Button>
      ) : null}
    </span>
  );
}
