"use client";

import { useEffect } from "react";
import type { Room, Unit } from "@/lib/types";
import { toMm } from "@/lib/units";
import type { UseHistoryReturn } from "@/lib/useHistory";

type SetRoom = UseHistoryReturn<Room>["setState"];

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Editor keyboard shortcuts:
 * - ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y on Windows): undo / redo
 * - With a piece selected: Delete/Backspace removes it; arrows nudge it
 *   1 unit (Shift: 0.1, ⌘/Ctrl: 5)
 * Ignored while typing in a field.
 */
export function useEditorShortcuts({
  undo,
  redo,
  selectedId,
  unit,
  removeItem,
  setRoom,
}: {
  undo: () => void;
  redo: () => void;
  selectedId: string | null;
  unit: Unit;
  removeItem: (id: string) => void;
  setRoom: SetRoom;
}) {
  // Global Undo / Redo shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z).
  // Works any time the user isn't typing into an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        // Windows convention
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Keyboard shortcuts when an item is selected.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeItem(selectedId);
        return;
      }
      const arrow = ARROWS[e.key];
      if (!arrow) return;
      e.preventDefault();
      let amount = 1;
      if (e.shiftKey) amount = 0.1;
      else if (e.metaKey || e.ctrlKey) amount = 5;
      const dxMm = arrow[0] * toMm(amount, unit);
      const dyMm = arrow[1] * toMm(amount, unit);
      setRoom((r) => ({
        ...r,
        items: r.items.map((it) =>
          it.id === selectedId ? { ...it, x: it.x + dxMm, y: it.y + dyMm } : it,
        ),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeItem, unit, setRoom]);
}
