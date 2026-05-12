"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Unit } from "@/lib/types";
import { fromMm, toMm } from "@/lib/units";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  roomName: string;
  unit: Unit;
  wallWidthMm: number;
  wallHeightMm: number;
  snapEnabled: boolean;
  eyeLineEnabled: boolean;
  eyeLineHeightMm: number;
  saveStatus: SaveStatus;
  onChangeName: (name: string) => void;
  onChangeUnit: (unit: Unit) => void;
  onChangeWall: (widthMm: number, heightMm: number) => void;
  onChangeSnap: (enabled: boolean) => void;
  onChangeEyeLineEnabled: (enabled: boolean) => void;
  onChangeEyeLineHeight: (heightMm: number) => void;
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
  eyeLineEnabled,
  eyeLineHeightMm,
  saveStatus,
  onChangeName,
  onChangeUnit,
  onChangeWall,
  onChangeSnap,
  onChangeEyeLineEnabled,
  onChangeEyeLineHeight,
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
    if (w > 0 && h > 0) {
      onChangeWall(toMm(w, unit), toMm(h, unit));
    }
  }

  function commitEyeLine() {
    const v = Number(eyeInput);
    if (v > 0) {
      onChangeEyeLineHeight(toMm(v, unit));
    } else {
      setEyeInput(fromMm(eyeLineHeightMm, unit).toFixed(1));
    }
  }

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== roomName) onChangeName(trimmed);
    else setNameInput(roomName);
  }

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 bg-white">
      <Link
        href="/"
        className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 -ml-2 rounded hover:bg-zinc-100"
        title="Back to all rooms"
      >
        ← Rooms
      </Link>

      <input
        type="text"
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="text-base font-semibold text-zinc-800 bg-transparent border border-transparent hover:border-zinc-200 focus:border-zinc-300 rounded px-2 py-1 outline-none min-w-0 flex-shrink"
        aria-label="Room name"
      />

      <SaveIndicator status={saveStatus} />

      <div className="flex items-center gap-2 ml-4 pl-4 border-l border-zinc-200">
        <span className="text-xs text-zinc-500">Wall</span>
        <input
          type="number"
          step="0.5"
          min="0"
          value={wInput}
          onChange={(e) => setWInput(e.target.value)}
          onBlur={commitWall}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-20 border border-zinc-300 rounded px-2 py-1 text-sm"
          aria-label="Wall width"
        />
        <span className="text-xs text-zinc-500">×</span>
        <input
          type="number"
          step="0.5"
          min="0"
          value={hInput}
          onChange={(e) => setHInput(e.target.value)}
          onBlur={commitWall}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-20 border border-zinc-300 rounded px-2 py-1 text-sm"
          aria-label="Wall height"
        />
      </div>

      <div className="flex items-center gap-1 border border-zinc-300 rounded overflow-hidden">
        <button
          type="button"
          onClick={() => onChangeUnit("in")}
          className={`px-2 py-1 text-xs ${
            unit === "in" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"
          }`}
        >
          in
        </button>
        <button
          type="button"
          onClick={() => onChangeUnit("cm")}
          className={`px-2 py-1 text-xs ${
            unit === "cm" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"
          }`}
        >
          cm
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChangeSnap(!snapEnabled)}
        title="Toggle snap (hold Alt to disable while dragging)"
        className={`border rounded px-2 py-1 text-xs ${
          snapEnabled
            ? "bg-blue-50 border-blue-300 text-blue-700"
            : "bg-white border-zinc-300 text-zinc-500"
        }`}
      >
        Snap: {snapEnabled ? "on" : "off"}
      </button>

      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-zinc-200">
        <button
          type="button"
          onClick={() => onChangeEyeLineEnabled(!eyeLineEnabled)}
          title={`Toggle the 57" gallery eye line`}
          className={`border rounded px-2 py-1 text-xs ${
            eyeLineEnabled
              ? "bg-amber-50 border-amber-300 text-amber-800"
              : "bg-white border-zinc-300 text-zinc-500"
          }`}
        >
          Eye line: {eyeLineEnabled ? "on" : "off"}
        </button>
        <input
          type="number"
          step="0.5"
          min="0"
          value={eyeInput}
          onChange={(e) => setEyeInput(e.target.value)}
          onBlur={commitEyeLine}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-16 border border-zinc-300 rounded px-2 py-1 text-sm disabled:opacity-50"
          aria-label="Eye line height from floor"
          disabled={!eyeLineEnabled}
          title="Height from floor to center of art"
        />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onExportPNG}
        className="border border-zinc-300 rounded px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        Export PNG
      </button>
      <button
        type="button"
        onClick={onExportPDF}
        className="border border-zinc-300 rounded px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        Export PDF
      </button>
      <button
        type="button"
        onClick={onClear}
        className="border border-zinc-300 rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
      >
        Clear wall
      </button>
    </header>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const text =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed"
          : "";
  const color =
    status === "error"
      ? "text-red-600"
      : status === "saving"
        ? "text-zinc-500"
        : "text-zinc-400";
  return (
    <span
      className={`text-xs ${color} min-w-[64px]`}
      aria-live="polite"
    >
      {text}
    </span>
  );
}
