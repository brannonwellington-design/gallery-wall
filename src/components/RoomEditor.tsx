"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import type { Frame, Item, Room, Unit } from "@/lib/types";
import { DEFAULT_EYE_LINE_HEIGHT_MM } from "@/lib/defaults";
import { eyeLine } from "@/lib/geometry";
import { randomizeLayout } from "@/lib/layout";
import { clearDraft, loadDraft } from "@/lib/roomDraft";
import {
  mergeStoredImageUrls,
  preferStoredImages,
  roomExceedsPatchLimit,
} from "@/lib/externalizeClient";
import { roomFingerprint } from "@/lib/roomFingerprint";
import { normalizeRoom } from "@/lib/roomMigrations";
import { useHistory } from "@/lib/useHistory";
import { useRoomAutosave } from "@/lib/useRoomAutosave";
import AddItemForm from "./AddItemForm";
import EditItemPanel from "./EditItemPanel";
import ItemsList from "./ItemsList";
import Toolbar from "./Toolbar";
import { useBackgroundRemoval } from "./editor/useBackgroundRemoval";
import { useEditorShortcuts } from "./editor/useEditorShortcuts";
import { useWallExport } from "./editor/useWallExport";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

const WallCanvas = dynamic(() => import("./WallCanvas"), { ssr: false });

function uid(): string {
  // Unguessable and collision-free; also satisfies the server's id format.
  return crypto.randomUUID();
}


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
  const [clearOpen, setClearOpen] = useState(false);
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
    initialUpdatedAt,
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
      // A draft built on an older server version would overwrite whatever
      // was saved since (by another tab or person), so it's discarded.
      const draftIsCurrent =
        !draft?.baseUpdatedAt ||
        Date.parse(draft.baseUpdatedAt) === Date.parse(initialUpdatedAt);
      const draftRoom = draft ? normalizeRoom(draft.room) : null;
      if (
        draftRoom &&
        draftIsCurrent &&
        roomFingerprint(draftRoom) !== roomFingerprint(initialRoom)
      ) {
        // Prefer Storage URLs from the server when the draft still has huge
        // inline data URLs (pre-migration crash drafts).
        let recovered = preferStoredImages(draftRoom, initialRoom);
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
    imageSrc: string;
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
      const result = randomizeLayout(
        r.items,
        { width: r.wallWidth, height: r.wallHeight },
        eyeLine(r)?.y ?? null,
      );
      if (!result.template) {
        flashLayoutStatus("Couldn’t fit — try fewer pieces or a bigger wall");
        return r;
      }
      flashLayoutStatus(`${capitalize(result.template)} layout`);
      return { ...r, items: result.items };
    });
  }, [setRoom]);

  const { bgBusyId, bgError, dismissBgError, toggleBackground } =
    useBackgroundRemoval(room.items, setRoom);
  useEditorShortcuts({ undo, redo, selectedId, unit: room.unit, removeItem, setRoom });
  const { exportPNG, exportPDF } = useWallExport(stageRef, room.name);

  function requestClearWall() {
    setClearOpen(true);
  }

  function confirmClearWall() {
    setRoom((r) => ({ ...r, items: [] }));
    setSelectedId(null);
    setClearOpen(false);
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
        onClear={requestClearWall}
      />

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 shrink-0 border-r border-surface-tertiary bg-surface-highlight flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-surface-tertiary">
            <div className="text-caption text-content-disabled mb-1">
              Catalog
            </div>
            <h2 className="text-lead text-content-primary">
              Pieces
            </h2>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {bgError ? (
              <Alert variant="destructive" className="mx-6 mt-4 w-auto">
                <AlertDescription className="flex items-start gap-2">
                  <span className="flex-1 break-words">{bgError}</span>
                  <button
                    type="button"
                    onClick={dismissBgError}
                    className="shrink-0 underline"
                  >
                    Dismiss
                  </button>
                </AlertDescription>
              </Alert>
            ) : null}
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
          </ScrollArea>
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

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear wall</AlertDialogTitle>
            <AlertDialogDescription>
              Remove all pieces from this wall?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmClearWall}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
