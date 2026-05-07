"use client";

import type { Unit } from "@/lib/types";
import { fromMm, toMm } from "@/lib/units";
import { useEffect, useState } from "react";

type Props = {
  unit: Unit;
  wallWidthMm: number;
  wallHeightMm: number;
  onChangeUnit: (unit: Unit) => void;
  onChangeWall: (widthMm: number, heightMm: number) => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onReset: () => void;
};

export default function Toolbar({
  unit,
  wallWidthMm,
  wallHeightMm,
  onChangeUnit,
  onChangeWall,
  onExportPNG,
  onExportPDF,
  onReset,
}: Props) {
  const [wInput, setWInput] = useState(() => fromMm(wallWidthMm, unit).toFixed(1));
  const [hInput, setHInput] = useState(() => fromMm(wallHeightMm, unit).toFixed(1));

  // Mirror external wall/unit changes back into the inputs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWInput(fromMm(wallWidthMm, unit).toFixed(1));
    setHInput(fromMm(wallHeightMm, unit).toFixed(1));
  }, [wallWidthMm, wallHeightMm, unit]);

  function commitWall() {
    const w = Number(wInput);
    const h = Number(hInput);
    if (w > 0 && h > 0) {
      onChangeWall(toMm(w, unit), toMm(h, unit));
    }
  }

  return (
    <header className="flex items-center gap-4 px-4 py-2 border-b border-zinc-200 bg-white">
      <h1 className="text-base font-semibold text-zinc-800">Gallery Wall</h1>

      <div className="flex items-center gap-2 ml-4">
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
        onClick={onReset}
        className="border border-zinc-300 rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
      >
        Reset
      </button>
    </header>
  );
}
