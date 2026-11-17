"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import type { Fixture, FixtureKind, Frame, Item, Room, Unit } from "@/lib/types";
import { constrainFixture, layoutContextFor, makeFixture } from "@/lib/fixtures";
import { DEFAULT_EYE_LINE_HEIGHT_MM } from "@/lib/defaults";
import { duplicateItems } from "@/lib/arrange";
import { FIT_VIEW, isFitView, type CanvasView } from "@/lib/canvasView";
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
import FixturesPanel from "./FixturesPanel";
import ItemsList from "./ItemsList";
import SelectionPanel from "./SelectionPanel";
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
  // Selected pieces, in the order they were picked. Selecting pieces and
  // selecting a fixture are mutually exclusive.
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const selectedIds = useMemo(() => new Set(selection), [selection]);
  const selectedId = selection.length === 1 ? selection[0] : null;
  const selectItem = useCallback((id: string | null, additive = false) => {
    setSelectedFixtureId(null);
    if (id === null) {
      setSelection([]);
      return;
    }
    setSelection((prev) =>
      additive ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id],
    );
  }, []);
  const selectFixture = useCallback((id: string) => {
    setSelection([]);
    setSelectedFixtureId(id);
  }, []);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [redlinesEnabled, setRedlinesEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [clearOpen, setClearOpen] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [view, setView] = useState<CanvasView>(FIT_VIEW);

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

  /** Commit new positions for one or more pieces as a single undo step. */
  const moveItemsTo = useCallback((moves: { id: string; x: number; y: number }[]) => {
    const byId = new Map(moves.map((m) => [m.id, m]));
    setRoom((r) => ({
      ...r,
      items: r.items.map((it) => {
        const m = byId.get(it.id);
        return m ? { ...it, x: m.x, y: m.y } : it;
      }),
    }));
  }, [setRoom]);

  /** Apply an arrange operation (align, distribute, …) to the room's pieces. */
  const arrange = useCallback(
    (fn: (items: Item[]) => Item[]) => setRoom((r) => ({ ...r, items: fn(r.items) })),
    [setRoom],
  );

  const duplicateSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const copies = duplicateItems(room.items, selectedIds, uid);
    setRoom((r) => ({ ...r, items: [...r.items, ...copies] }));
    setSelection(copies.map((c) => c.id));
  }, [room.items, selectedIds, setRoom]);

  const selectAll = useCallback(() => {
    setSelectedFixtureId(null);
    setSelection(room.items.map((it) => it.id));
  }, [room.items]);

  const addFixture = useCallback(
    (kind: FixtureKind) => {
      const id = uid();
      setRoom((r) => ({ ...r, fixtures: [...(r.fixtures ?? []), makeFixture(kind, r, id)] }));
      selectFixture(id);
    },
    [setRoom, selectFixture],
  );

  const updateFixture = useCallback(
    (id: string, patch: Partial<Fixture>) => {
      setRoom((r) => ({
        ...r,
        fixtures: (r.fixtures ?? []).map((f) => (f.id === id ? constrainFixture({ ...f, ...patch }, r) : f)),
      }));
    },
    [setRoom],
  );

  const removeFixture = useCallback(
    (id: string) => {
      setRoom((r) => ({ ...r, fixtures: (r.fixtures ?? []).filter((f) => f.id !== id) }));
      setSelectedFixtureId((prev) => (prev === id ? null : prev));
    },
    [setRoom],
  );

  const removeItems = useCallback((ids: Set<string>) => {
    setRoom((r) => ({ ...r, items: r.items.filter((it) => !ids.has(it.id)) }));
    setSelection((prev) => prev.filter((x) => !ids.has(x)));
  }, [setRoom]);
  const removeItem = useCallback((id: string) => removeItems(new Set([id])), [removeItems]);

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
        undefined,
        layoutContextFor(r),
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
  useEditorShortcuts({
    undo,
    redo,
    selectedIds,
    unit: room.unit,
    removeItems,
    duplicate: duplicateSelection,
    selectAll,
    clearSelection: () => selectItem(null),
    setRoom,
  });
  const wallExport = useWallExport(stageRef, room.name);
  // Exports capture the canvas as drawn, so fit the whole wall first.
  const withFitView = useCallback(
    (run: () => void | Promise<void>) => () => {
      if (isFitView(view)) return void run();
      setView(FIT_VIEW);
      requestAnimationFrame(() => requestAnimationFrame(() => void run()));
    },
    [view],
  );
  const exportPNG = withFitView(wallExport.exportPNG);
  const exportPDF = withFitView(wallExport.exportPDF);

  function requestClearWall() {
    setClearOpen(true);
  }

  function confirmClearWall() {
    setRoom((r) => ({ ...r, items: [] }));
    setSelection([]);
    setClearOpen(false);
  }

  return (
    <div className="flex flex-col h-screen w-full bg-surface-primary text-content-secondary">
      <Toolbar
        guideHref={`/rooms/${roomId}/guide`}
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
              selectedIds={selectedIds}
              bgBusyId={bgBusyId}
              onSelect={selectItem}
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
                    onDuplicate={duplicateSelection}
                    onClose={() => selectItem(null)}
                  />
                ) : null;
              })()}
            {selection.length > 1 ? (
              <SelectionPanel
                room={room}
                selectedIds={selectedIds}
                onArrange={arrange}
                onDuplicate={duplicateSelection}
                onRemove={() => removeItems(selectedIds)}
                onClear={() => selectItem(null)}
              />
            ) : null}
            <AddItemForm unit={room.unit} onAdd={addItem} />
            <FixturesPanel
              room={room}
              selectedId={selectedFixtureId}
              onSelect={selectFixture}
              onAdd={addFixture}
              onUpdate={updateFixture}
              onRemove={removeFixture}
            />
          </ScrollArea>
        </aside>

        <main className="flex-1 min-w-0">
          <WallCanvas
            ref={stageRef}
            room={room}
            selectedIds={selectedIds}
            snapEnabled={snapEnabled}
            redlinesEnabled={redlinesEnabled}
            onSelect={selectItem}
            onMoveItems={moveItemsTo}
            view={view}
            onViewChange={setView}
            selectedFixtureId={selectedFixtureId}
            onSelectFixture={selectFixture}
            onMoveFixture={(id, x, y) => updateFixture(id, { x, y })}
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
