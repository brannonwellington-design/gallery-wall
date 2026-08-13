"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileDown, Redo2, Shuffle, Trash2, Undo2 } from "lucide-react";
import { formatAbsolute, formatEditedLabel } from "@/lib/dates";
import type { Unit } from "@/lib/types";
import { fromMm, toMm } from "@/lib/units";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

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
        <Link
          href="/"
          className="inline-flex items-center gap-1 h-8 px-2 -ml-2 rounded-lg text-[12px] leading-4 text-content-primary hover:bg-surface-secondary"
          title="Back to rooms"
        >
          <ArrowLeft size={14} strokeWidth={1} aria-hidden="true" />
          Rooms
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] leading-4 text-content-secondary shrink-0 select-none">
            Listen Labs /
          </span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 px-2 text-[16px] leading-6 text-content-primary bg-transparent border border-transparent hover:border-surface-tertiary focus:border-content-disabled rounded-lg min-w-0 w-48"
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
            <span
              className="text-[11px] leading-4 text-content-disabled tabular hidden sm:inline"
              title={formatAbsolute(lastEditedAt)}
            >
              {formatEditedLabel(lastEditedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-2" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExportPNG}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] leading-4 text-content-primary hover:bg-surface-secondary"
          >
            <Download size={14} strokeWidth={1} aria-hidden="true" />
            PNG
          </button>
          <button
            type="button"
            onClick={onExportPDF}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] leading-4 text-content-primary hover:bg-surface-secondary"
          >
            <FileDown size={14} strokeWidth={1} aria-hidden="true" />
            PDF
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] leading-4 text-content-primary hover:text-content-negative hover:bg-surface-negative-secondary"
            title="Clear wall"
          >
            <Trash2 size={14} strokeWidth={1} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {/* Wall, guides, layout — grouped by whitespace, not hairlines. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2 bg-surface-highlight border-t border-surface-tertiary">
        <div className="flex items-center gap-2">
          <span className="text-[10px] leading-4 text-content-disabled">Wall</span>
          <NumInput value={wInput} onChange={setWInput} onCommit={commitWall} ariaLabel="Wall width" />
          <span className="text-[12px] leading-4 text-content-disabled">×</span>
          <NumInput value={hInput} onChange={setHInput} onCommit={commitWall} ariaLabel="Wall height" />
          <UnitToggle unit={unit} onChange={onChangeUnit} />
        </div>

        <div className="flex items-center gap-1">
          <ToggleButton
            active={snapEnabled}
            onClick={() => onChangeSnap(!snapEnabled)}
            title="Toggle snap (hold Alt to disable while dragging)"
          >
            Snap
          </ToggleButton>
          <ToggleButton
            active={redlinesEnabled}
            onClick={() => onChangeRedlines(!redlinesEnabled)}
            title="Show spacing between pieces and to the wall edges"
          >
            Redlines
          </ToggleButton>
          <ToggleButton
            active={eyeLineEnabled}
            onClick={() => onChangeEyeLineEnabled(!eyeLineEnabled)}
            title={`Toggle the 57" gallery eye line`}
          >
            Eye line
          </ToggleButton>
          <NumInput
            value={eyeInput}
            onChange={setEyeInput}
            onCommit={commitEyeLine}
            disabled={!eyeLineEnabled}
            ariaLabel="Eye line height from floor"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRandomize}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] leading-4 text-content-primary hover:bg-surface-secondary"
            title="Randomize layout — re-arrange unpinned pieces using a classic gallery pattern"
          >
            <Shuffle size={14} strokeWidth={1} aria-hidden="true" />
            Randomize
          </button>
          {layoutStatus ? (
            <span
              className="text-[10px] leading-4 text-content-secondary"
              aria-live="polite"
            >
              {layoutStatus}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-2" />

        <div className="flex items-center">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (⌘Z)"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-content-primary hover:bg-surface-secondary disabled:text-content-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <Undo2 size={14} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-content-primary hover:bg-surface-secondary disabled:text-content-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <Redo2 size={14} strokeWidth={1} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
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
    <input
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
      className="w-16 h-8 px-2 border border-surface-tertiary rounded-lg text-[14px] leading-5 text-content-primary bg-surface-primary tabular disabled:opacity-50"
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
    <div className="flex items-center h-8 border border-surface-tertiary rounded-lg overflow-hidden">
      {(["in", "cm"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`h-full px-2 text-[12px] leading-4 ${
            unit === u
              ? "bg-surface-inverse-primary text-content-inverse-primary"
              : "bg-surface-primary text-content-primary hover:bg-surface-secondary"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-8 px-3 rounded-lg text-[12px] leading-4 ${
        active
          ? "bg-surface-brand-secondary text-content-brand"
          : "text-content-secondary hover:text-content-primary hover:bg-surface-secondary"
      }`}
    >
      {children}
    </button>
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
            : "";
  const color =
    status === "error"
      ? "text-content-negative"
      : status === "unsaved"
        ? "text-content-secondary"
        : "text-content-disabled";
  const title =
    status === "error"
      ? error || "Save failed — click to retry"
      : status === "saved" && error
        ? error
        : undefined;

  return (
    <span
      className={`text-[11px] leading-4 ${color} min-w-[56px] inline-flex items-center gap-1.5`}
      aria-live="polite"
      title={title}
    >
      <span>{text}</span>
      {status === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="underline text-content-negative hover:text-content-primary"
        >
          Retry
        </button>
      ) : null}
    </span>
  );
}
