"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import type { Frame, Item, Room, Unit } from "@/lib/types";
import { makeDefaultRoom } from "@/lib/defaults";
import { toMm } from "@/lib/units";
import AddItemForm from "./AddItemForm";
import ItemsList from "./ItemsList";
import Toolbar, { type SaveStatus } from "./Toolbar";

const WallCanvas = dynamic(() => import("./WallCanvas"), { ssr: false });

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type Props = {
  roomId: string;
  initialRoom: Room;
};

export default function RoomEditor({ roomId, initialRoom }: Props) {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const stageRef = useRef<Konva.Stage | null>(null);

  // Auto-save: debounce 500ms after the last change.
  const lastSaved = useRef<string>(JSON.stringify(initialRoom));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const snapshot = JSON.stringify(room);
    if (snapshot === lastSaved.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(snapshot, room);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    async function save(snap: string, body: Room) {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: body }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
        lastSaved.current = snap;
        setSaveStatus("saved");
      } catch (e) {
        console.error("Save failed", e);
        setSaveStatus("error");
      }
    }
  }, [room, roomId]);

  function changeUnit(unit: Unit) {
    setRoom((r) => ({ ...r, unit }));
  }

  function changeWall(wallWidth: number, wallHeight: number) {
    setRoom((r) => ({ ...r, wallWidth, wallHeight }));
  }

  function changeName(name: string) {
    setRoom((r) => ({ ...r, name }));
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

  const removeItem = useCallback((id: string) => {
    setRoom((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const [bgBusyId, setBgBusyId] = useState<string | null>(null);

  const toggleBackground = useCallback(
    async (id: string) => {
      const item = room.items.find((i) => i.id === id);
      if (!item) return;

      // If the original is stashed, restore it without a network call.
      if (item.imageOriginalDataUrl) {
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  imageDataUrl: it.imageOriginalDataUrl!,
                  imageOriginalDataUrl: null,
                }
              : it,
          ),
        }));
        return;
      }

      setBgBusyId(id);
      try {
        const res = await fetch("/api/remove-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: item.imageDataUrl }),
        });
        const data = (await res.json()) as {
          imageDataUrl?: string;
          error?: string;
        };
        if (!res.ok || !data.imageDataUrl) {
          throw new Error(data.error || `Failed (${res.status})`);
        }
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  imageOriginalDataUrl: it.imageDataUrl,
                  imageDataUrl: data.imageDataUrl!,
                }
              : it,
          ),
        }));
      } catch (e) {
        alert(
          `Couldn't remove background: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      } finally {
        setBgBusyId(null);
      }
    },
    [room.items],
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
      let amount = 1;
      if (e.shiftKey) amount = 0.1;
      else if (e.metaKey || e.ctrlKey) amount = 5;
      const dxMm = arrow[0] * toMm(amount, room.unit);
      const dyMm = arrow[1] * toMm(amount, room.unit);
      setRoom((r) => ({
        ...r,
        items: r.items.map((it) =>
          it.id === selectedId ? { ...it, x: it.x + dxMm, y: it.y + dyMm } : it,
        ),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, removeItem, room.unit]);

  function clearWall() {
    if (!confirm("Remove all pieces from this wall?")) return;
    setRoom((r) => ({ ...makeDefaultRoom(), name: r.name }));
    setSelectedId(null);
  }

  function exportPNG() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slug(room.name)}.png`;
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
    pdf.save(`${slug(room.name)}.pdf`);
  }

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-50 text-zinc-900">
      <Toolbar
        roomName={room.name}
        unit={room.unit}
        wallWidthMm={room.wallWidth}
        wallHeightMm={room.wallHeight}
        snapEnabled={snapEnabled}
        saveStatus={saveStatus}
        onChangeName={changeName}
        onChangeUnit={changeUnit}
        onChangeWall={changeWall}
        onChangeSnap={setSnapEnabled}
        onExportPNG={exportPNG}
        onExportPDF={exportPDF}
        onClear={clearWall}
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
            bgBusyId={bgBusyId}
            onSelect={setSelectedId}
            onRemove={removeItem}
            onToggleBackground={toggleBackground}
          />
          <AddItemForm unit={room.unit} onAdd={addItem} />
        </aside>

        <main className="flex-1 min-w-0">
          <WallCanvas
            ref={stageRef}
            room={room}
            selectedId={selectedId}
            snapEnabled={snapEnabled}
            onSelect={setSelectedId}
            onMoveItem={moveItem}
          />
        </main>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "gallery-wall";
}
