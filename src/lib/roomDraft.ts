import type { Room } from "./types";

const DB_NAME = "gallery-wall-drafts";
const DB_VERSION = 1;
const STORE = "drafts";

export type RoomDraft = {
  roomId: string;
  room: Room;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "roomId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveDraft(roomId: string, room: Room): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("draft write failed"));
      tx.objectStore(STORE).put({
        roomId,
        room,
        updatedAt: Date.now(),
      } satisfies RoomDraft);
    });
    db.close();
  } catch (e) {
    // Drafts are best-effort — never block editing if storage is unavailable.
    console.warn("[room-draft] save failed", e);
  }
}

export async function loadDraft(roomId: string): Promise<RoomDraft | null> {
  try {
    const db = await openDb();
    const draft = await new Promise<RoomDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(roomId);
      req.onsuccess = () => resolve((req.result as RoomDraft | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("draft read failed"));
    });
    db.close();
    return draft;
  } catch (e) {
    console.warn("[room-draft] load failed", e);
    return null;
  }
}

export async function clearDraft(roomId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("draft clear failed"));
      tx.objectStore(STORE).delete(roomId);
    });
    db.close();
  } catch (e) {
    console.warn("[room-draft] clear failed", e);
  }
}
