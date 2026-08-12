"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import type { Frame, Item, Room, Unit } from "@/lib/types";
import { DEFAULT_EYE_LINE_HEIGHT_MM } from "@/lib/defaults";
import { cropToOpaqueBounds, downscaleTransparentImage } from "@/lib/image";
import { randomizeLayout } from "@/lib/layout";
import { clearDraft, loadDraft } from "@/lib/roomDraft";
import {
  mergeStoredImageUrls,
  preferStoredImages,
  roomExceedsPatchLimit,
} from "@/lib/externalizeClient";
import { roomFingerprint } from "@/lib/roomFingerprint";
import { toMm } from "@/lib/units";
import { useHistory } from "@/lib/useHistory";
import { useRoomAutosave } from "@/lib/useRoomAutosave";
import AddItemForm from "./AddItemForm";
import EditItemPanel from "./EditItemPanel";
import ItemsList from "./ItemsList";
import Toolbar from "./Toolbar";

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
  initialUpdatedAt: string;
};

export default function RoomEditor({
  roomId,
  initialRoom,
  initialUpdatedAt,
}: Props) {
  const {
    state: room,
    setState: setRoom,
    setStateSilent,
    replaceState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Room>(initialRoom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [redlinesEnabled, setRedlinesEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const stageRef = useRef<Konva.Stage | null>(null);

  const onSaved = useCallback((iso: string) => {
    setUpdatedAt(iso);
  }, []);

  const onRoomNormalized = useCallback(
    (normalized: Room) => {
      // Only swap data: image URLs → Storage https URLs. Keep the live
      // room's layout/eye-line/etc. so an in-flight save can't clobber
      // edits the user made while it was uploading.
      setStateSilent((current) => mergeStoredImageUrls(current, normalized));
    },
    [setStateSilent],
  );

  const { saveStatus, saveError, retrySave, markSaved } = useRoomAutosave({
    roomId,
    room,
    enabled: ready,
    onSaved,
    onRoomNormalized,
  });

  // Crash recovery: restore a newer local draft before enabling autosave.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft(roomId);
      if (cancelled) return;
      if (
        draft &&
        roomFingerprint(draft.room) !== roomFingerprint(initialRoom)
      ) {
        // Prefer Storage URLs from the server when the draft still has huge
        // inline data URLs (pre-migration crash drafts).
        let recovered = preferStoredImages(draft.room, initialRoom);
        if (roomExceedsPatchLimit(recovered)) {
          recovered = preferStoredImages(recovered, initialRoom);
        }
        replaceState(recovered);
        // Leave dirty — autosave will push the recovered draft to the server.
      } else {
        markSaved(initialRoom);
        void clearDraft(roomId);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount / room identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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
  }, [setRoom]);

  const removeItem = useCallback((id: string) => {
    setRoom((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [setRoom]);

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setRoom((r) => ({
      ...r,
      items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }, [setRoom]);

  const togglePin = useCallback((id: string) => {
    setRoom((r) => ({
      ...r,
      items: r.items.map((it) =>
        it.id === id ? { ...it, pinned: !it.pinned } : it,
      ),
    }));
  }, [setRoom]);

  const [layoutStatus, setLayoutStatus] = useState<string | null>(null);
  const layoutStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashLayoutStatus(msg: string) {
    setLayoutStatus(msg);
    if (layoutStatusTimer.current) clearTimeout(layoutStatusTimer.current);
    layoutStatusTimer.current = setTimeout(() => setLayoutStatus(null), 2500);
  }

  const randomize = useCallback(() => {
    setRoom((r) => {
      const eyeLineEnabled = r.eyeLineEnabled ?? true;
      const eyeLineHeight = r.eyeLineHeight ?? DEFAULT_EYE_LINE_HEIGHT_MM;
      // Eye line is stored as distance from floor; layout engine wants
      // y from the top of the wall.
      const eyeLineY =
        eyeLineEnabled && eyeLineHeight > 0 && eyeLineHeight < r.wallHeight
          ? r.wallHeight - eyeLineHeight
          : null;
      const result = randomizeLayout(
        r.items,
        { width: r.wallWidth, height: r.wallHeight },
        eyeLineY,
      );
      if (!result.template) {
        flashLayoutStatus("Couldn’t fit — try fewer pieces or a bigger wall");
        return r;
      }
      flashLayoutStatus(`${capitalize(result.template)} layout`);
      return { ...r, items: result.items };
    });
  }, [setRoom]);

  const [bgBusyId, setBgBusyId] = useState<string | null>(null);

  const toggleBackground = useCallback(
    async (id: string) => {
      const item = room.items.find((i) => i.id === id);
      if (!item) return;

      // If the original is stashed, restore it (and the pre-crop dims, if
      // we shrank them) without a network call.
      if (item.imageOriginalDataUrl) {
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  imageDataUrl: it.imageOriginalDataUrl!,
                  imageOriginalDataUrl: null,
                  artWidth: it.artWidthOriginal ?? it.artWidth,
                  artHeight: it.artHeightOriginal ?? it.artHeight,
                  artWidthOriginal: null,
                  artHeightOriginal: null,
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
        // Auto-crop transparent padding so frame/matte hug the actual art,
        // and shrink physical dims by the same ratio to preserve on-wall
        // size. If the result is already tight, crop returns null and we
        // keep dims unchanged.
        let finalImage = data.imageDataUrl;
        let widthRatio = 1;
        let heightRatio = 1;
        try {
          const cropped = await cropToOpaqueBounds(data.imageDataUrl);
          if (cropped) {
            finalImage = cropped.dataUrl;
            widthRatio = cropped.widthRatio;
            heightRatio = cropped.heightRatio;
          }
        } catch {
          // Crop failures shouldn't block the bg-removal result.
        }
        // Cap PNG size so rooms stay under the PATCH body limit.
        try {
          finalImage = await downscaleTransparentImage(finalImage);
        } catch {
          // Keep the full PNG if downscale fails.
        }
        setRoom((r) => ({
          ...r,
          items: r.items.map((it) => {
            if (it.id !== id) return it;
            const cropped = widthRatio < 1 || heightRatio < 1;
            return {
              ...it,
              imageOriginalDataUrl: it.imageDataUrl,
              imageDataUrl: finalImage,
              ...(cropped
                ? {
                    artWidthOriginal: it.artWidth,
                    artHeightOriginal: it.artHeight,
                    artWidth: it.artWidth * widthRatio,
                    artHeight: it.artHeight * heightRatio,
                  }
                : {}),
            };
          }),
        }));
      } catch (e) {
        alert(
          `Couldn’t remove background: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      } finally {
        setBgBusyId(null);
      }
    },
    [room.items, setRoom],
  );

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
  }, [selectedId, removeItem, room.unit, setRoom]);

  function clearWall() {
    if (!confirm("Remove all pieces from this wall?")) return;
    setRoom((r) => ({ ...r, items: [] }));
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
    <div className="flex flex-col h-screen w-full bg-surface-primary text-content-secondary">
      <Toolbar
        roomName={room.name}
        unit={room.unit}
        wallWidthMm={room.wallWidth}
        wallHeightMm={room.wallHeight}
        snapEnabled={snapEnabled}
        redlinesEnabled={redlinesEnabled}
        eyeLineEnabled={room.eyeLineEnabled ?? true}
        eyeLineHeightMm={room.eyeLineHeight ?? DEFAULT_EYE_LINE_HEIGHT_MM}
        saveStatus={saveStatus}
        saveError={saveError}
        onRetrySave={retrySave}
        lastEditedAt={updatedAt}
        onChangeName={changeName}
        onChangeUnit={changeUnit}
        onChangeWall={changeWall}
        onChangeSnap={setSnapEnabled}
        onChangeRedlines={setRedlinesEnabled}
        onChangeEyeLineEnabled={(enabled) =>
          setRoom((r) => ({ ...r, eyeLineEnabled: enabled }))
        }
        onChangeEyeLineHeight={(heightMm) =>
          setRoom((r) => ({ ...r, eyeLineHeight: heightMm }))
        }
        onRandomize={randomize}
        layoutStatus={layoutStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onExportPNG={exportPNG}
        onExportPDF={exportPDF}
        onClear={clearWall}
      />

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 border-r border-surface-tertiary bg-surface-highlight flex flex-col overflow-y-auto">
          <div className="px-6 py-5 border-b border-surface-tertiary">
            <div className="text-[10px] leading-4 text-content-disabled mb-1">
              Catalog
            </div>
            <h2 className="text-[16px] leading-6 text-content-primary">
              Pieces
            </h2>
          </div>
          <ItemsList
            items={room.items}
            unit={room.unit}
            selectedId={selectedId}
            bgBusyId={bgBusyId}
            onSelect={setSelectedId}
            onRemove={removeItem}
            onToggleBackground={toggleBackground}
            onTogglePin={togglePin}
          />
          {selectedId &&
            (() => {
              const selectedItem = room.items.find((i) => i.id === selectedId);
              return selectedItem ? (
                <EditItemPanel
                  key={selectedItem.id}
                  item={selectedItem}
                  unit={room.unit}
                  onUpdate={updateItem}
                  onTogglePin={() => togglePin(selectedItem.id)}
                  onClose={() => setSelectedId(null)}
                />
              ) : null;
            })()}
          <AddItemForm unit={room.unit} onAdd={addItem} />
        </aside>

        <main className="flex-1 min-w-0">
          <WallCanvas
            ref={stageRef}
            room={room}
            selectedId={selectedId}
            snapEnabled={snapEnabled}
            redlinesEnabled={redlinesEnabled}
            onSelect={setSelectedId}
            onMoveItem={moveItem}
          />
        </main>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "gallery-wall";
}
