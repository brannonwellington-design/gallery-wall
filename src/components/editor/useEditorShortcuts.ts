"use client";

import { useEffect } from "react";
import { moveItems } from "@/lib/arrange";
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

function typingIn(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  const tag = t?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t?.isContentEditable;
}

/**
 * Editor keyboard shortcuts (ignored while typing in a field):
 * - ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y): undo / redo
 * - ⌘A: select every piece · ⌘D: duplicate the selection · Esc: deselect
 * - With pieces selected: Delete/Backspace removes them; arrows nudge them
 *   1 unit (Shift: 0.1, ⌘/Ctrl: 5)
 */
export function useEditorShortcuts({
  undo,
  redo,
  selectedIds,
  unit,
  removeItems,
  duplicate,
  selectAll,
  clearSelection,
  setRoom,
}: {
  undo: () => void;
  redo: () => void;
  selectedIds: Set<string>;
  unit: Unit;
  removeItems: (ids: Set<string>) => void;
  duplicate: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  setRoom: SetRoom;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }
      if (key === "escape") {
        clearSelection();
        return;
      }

      if (selectedIds.size === 0) return;
      if (meta && key === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeItems(selectedIds);
        return;
      }
      const arrow = ARROWS[e.key];
      if (!arrow) return;
      e.preventDefault();
      let amount = 1;
      if (e.shiftKey) amount = 0.1;
      else if (meta) amount = 5;
      const dx = arrow[0] * toMm(amount, unit);
      const dy = arrow[1] * toMm(amount, unit);
      setRoom((r) => ({ ...r, items: moveItems(r.items, selectedIds, dx, dy) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedIds, unit, removeItems, duplicate, selectAll, clearSelection, setRoom]);
}
