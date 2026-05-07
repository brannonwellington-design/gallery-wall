"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import type { Frame, Item, Room, Unit } from "@/lib/types";
import { DEFAULT_ROOM, STORAGE_KEY } from "@/lib/defaults";
import { toMm } from "@/lib/units";
import AddItemForm from "./AddItemForm";
import ItemsList from "./ItemsList";
import Toolbar from "./Toolbar";

const WallCanvas = dynamic(() => import("./WallCanvas"), { ssr: false });

function loadRoom(): Room {
  if (typeof window === "undefined") return DEFAULT_ROOM;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROOM;
    const parsed = JSON.parse(raw) as Room;
    if (
      typeof parsed.wallWidth === "number" &&
      typeof parsed.wallHeight === "number" &&
      Array.isArray(parsed.items)
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return DEFAULT_ROOM;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export default function RoomEditor() {
  const [room, setRoom] = useState<Room>(DEFAULT_ROOM);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Load from localStorage after mount. SSR-safe hydration requires
  // initial render to match the server, then sync from storage on the client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoom(loadRoom());
    setHydrated(true);
  }, []);

  // Persist on every change (after initial load).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
    } catch {
      // ignore quota errors for the prototype
    }
  }, [room, hydrated]);

  function changeUnit(unit: Unit) {
    setRoom((r) => ({ ...r, unit }));
  }

  function changeWall(wallWidth: number, wallHeight: number) {
    setRoom((r) => ({ ...r, wallWidth, wallHeight }));
  }

  function addItem(data: {
    name: string;
    imageDataUrl: string;
    artWidth: number;
    artHeight: number;
    frame: Frame | null;
  }) {
    setRoom((r) => {
      const item: Item = {
        id: uid(),
        ...data,
        x: Math.max(0, (r.wallWidth - data.artWidth) / 2),
        y: Math.max(0, (r.wallHeight - data.artHeight) / 2),
      };
      return { ...r, items: [...r.items, item] };
    });
  }

  const moveItem = useCallback((id: string, x: number, y: number) => {
    setRoom((r) => ({
      ...r,
      items: r.items.map((it) => (it.id === id ? { ...it, x, y } : it)),
    }));
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setRoom((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [],
  );

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
      // Nudge: 1 unit by default (1 in or 1 cm), 0.1 unit with Shift,
      // 5 units with Ctrl/Meta.
      let amount = 1;
      if (e.shiftKey) amount = 0.1;
      else if (e.metaKey || e.ctrlKey) amount = 5;
      const dxMm = arrow[0] * toMm(amount, room.unit);
      const dyMm = arrow[1] * toMm(amount, room.unit);
      setRoom((r) => ({
        ...r,
        items: r.items.map((it) =>
          it.id === selectedId
            ? { ...it, x: it.x + dxMm, y: it.y + dyMm }
            : it,
        ),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeItem, room.unit]);

  function reset() {
    if (!confirm("Clear the wall and reset wall dimensions?")) return;
    setRoom(DEFAULT_ROOM);
    setSelectedId(null);
  }

  function exportPNG() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "gallery-wall.png";
    a.click();
  }

  async function exportPDF() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const { jsPDF } = await import("jspdf");
    const w = stage.width();
    const h = stage.height();
    const orientation = w >= h ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "pt", format: [w, h] });
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
    pdf.save("gallery-wall.pdf");
  }

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-50 text-zinc-900">
      <Toolbar
        unit={room.unit}
        wallWidthMm={room.wallWidth}
        wallHeightMm={room.wallHeight}
        snapEnabled={snapEnabled}
        onChangeUnit={changeUnit}
        onChangeWall={changeWall}
        onChangeSnap={setSnapEnabled}
        onExportPNG={exportPNG}
        onExportPDF={exportPDF}
        onReset={reset}
      />

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-zinc-200">
            <h2 className="text-sm font-semibold text-zinc-700">Pieces</h2>
          </div>
          <ItemsList
            items={room.items}
            unit={room.unit}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeItem}
          />
          <AddItemForm unit={room.unit} onAdd={addItem} />
        </aside>

        <main className="flex-1 min-w-0">
          {hydrated ? (
            <WallCanvas
              ref={stageRef}
              room={room}
              selectedId={selectedId}
              snapEnabled={snapEnabled}
              onSelect={setSelectedId}
              onMoveItem={moveItem}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
              Loading…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
