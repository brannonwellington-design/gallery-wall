"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "./types";
import {
  externalizeRoomImagesClient,
  mergeStoredImageUrls,
  roomExceedsPatchLimit,
  roomPayloadBytes,
} from "./externalizeClient";
import { mergeRooms } from "./mergeRooms";
import { clearDraft, saveDraft } from "./roomDraft";
import { roomFingerprint } from "./roomFingerprint";

export type SaveStatus =
  | "idle"
  | "unsaved"
  | "saving"
  | "saved"
  | "error"
  /** Someone else's changes couldn't be merged in; saving is paused. */
  | "conflict";

const CONFLICT_MESSAGE =
  "This room keeps changing somewhere else and your edits couldn’t be merged. Reload to get the latest version — edits since your last save won’t be kept.";

/** Give up merging (and show "Out of date") after this many 409s in a row. */
const MAX_MERGE_RETRIES = 3;

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

export type RemoteChange = {
  /** True when local unsaved edits were merged with the incoming version. */
  merged: boolean;
  /** Pieces both sides changed (local values kept for overlapping fields). */
  conflicts: number;
};

const DEBOUNCE_MS = 500;
const DRAFT_DEBOUNCE_MS = 200;
const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 15000;
/** Soft warn around Vercel Hobby body limits (~4.5 MB). */
const PAYLOAD_WARN_BYTES = 3_500_000;

type Options = {
  roomId: string;
  room: Room;
  /** updatedAt of the server copy the editor was loaded from. */
  initialUpdatedAt: string;
  /** When false, skip server saves (e.g. while restoring a local draft). */
  enabled?: boolean;
  /** Called after a successful server save with the new updatedAt. */
  onSaved?: (updatedAt: string) => void;
  /**
   * Called when inline images were uploaded to Storage so the editor can
   * swap data URLs for https URLs without treating it as a user edit.
   */
  onRoomNormalized?: (room: Room) => void;
  /**
   * Called with the room to show after someone else's save was pulled in
   * (merged with any unsaved local edits). The editor should replace its
   * state with it; autosave then saves the merge if it differs.
   */
  onRemoteChange?: (room: Room, change: RemoteChange) => void;
};

type SaveFn = (
  body: Room,
  opts?: { keepalive?: boolean },
) => Promise<void>;

export function useRoomAutosave({
  roomId,
  room,
  initialUpdatedAt,
  enabled = true,
  onSaved,
  onRoomNormalized,
  onRemoteChange,
}: Options): {
  saveStatus: SaveStatus;
  saveError: string | null;
  retrySave: () => void;
  markSaved: (r: Room) => void;
  /** Tell autosave the server's current updatedAt; pulls changes if it moved. */
  checkRemote: (serverUpdatedAt: string) => void;
} {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const roomRef = useRef(room);
  const enabledRef = useRef(enabled);
  const onSavedRef = useRef(onSaved);
  const onRoomNormalizedRef = useRef(onRoomNormalized);
  const lastSavedFp = useRef(roomFingerprint(room));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  /** Monotonic generation — only the latest in-flight save may commit success. */
  const saveGen = useRef(0);
  const inFlight = useRef(false);
  const pendingAfterFlight = useRef(false);
  const performSaveRef = useRef<SaveFn | null>(null);
  /** Server version our next save builds on — sent so the server can refuse stale writes. */
  const baseUpdatedAt = useRef(initialUpdatedAt);
  /** The server copy baseUpdatedAt refers to — the common ancestor for merges. */
  const baseRoom = useRef(room);
  const conflicted = useRef(false);
  const onRemoteChangeRef = useRef(onRemoteChange);
  const syncing = useRef(false);
  const needsSync = useRef(false);
  const mergeRetries = useRef(0);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    onRoomNormalizedRef.current = onRoomNormalized;
  }, [onRoomNormalized]);

  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  /**
   * Fetch the server's latest version and fold it in: adopt it outright if
   * there are no unsaved local edits, otherwise three-way merge.
   */
  const syncWithServer = useCallback(async (): Promise<boolean> => {
    if (syncing.current) return false;
    syncing.current = true;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
      if (!res.ok) return false;
      const data = (await res.json()) as { room: Room; updatedAt: string };
      if (sameInstant(data.updatedAt, baseUpdatedAt.current)) return true;
      const server = data.room;
      const local = roomRef.current;
      const clean = roomFingerprint(local) === lastSavedFp.current;
      const merged = clean
        ? { room: server, report: { conflicts: 0 } }
        : mergeRooms(baseRoom.current, local, server);
      baseRoom.current = server;
      baseUpdatedAt.current = data.updatedAt;
      lastSavedFp.current = roomFingerprint(server);
      roomRef.current = merged.room;
      onRemoteChangeRef.current?.(merged.room, {
        merged: !clean,
        conflicts: merged.report.conflicts,
      });
      onSavedRef.current?.(data.updatedAt);
      return true;
    } catch (e) {
      console.warn("[autosave] sync failed", e);
      return false;
    } finally {
      syncing.current = false;
    }
  }, [roomId]);

  const markSaved = useCallback((r: Room) => {
    lastSavedFp.current = roomFingerprint(r);
    setSaveStatus("saved");
    setSaveError(null);
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const performSave = useCallback<SaveFn>(
    async (body, { keepalive = false } = {}) => {
      if (!enabledRef.current || conflicted.current) return;

      let toSave = body;

      // If the room still has inline data URLs and the PATCH would exceed
      // Vercel's body limit, upload images individually first.
      if (roomExceedsPatchLimit(toSave)) {
        setSaveStatus("saving");
        setSaveError(null);
        const normalized = await externalizeRoomImagesClient(roomId, toSave);
        if (roomFingerprint(normalized) !== roomFingerprint(toSave)) {
          toSave = normalized;
          roomRef.current = normalized;
          onRoomNormalizedRef.current?.(normalized);
        }
        if (roomExceedsPatchLimit(toSave)) {
          setSaveStatus("error");
          setSaveError(
            "Room is too large to save. Try removing a few pieces or re-adding images.",
          );
          void saveDraft(roomId, toSave, baseUpdatedAt.current);
          return;
        }
      }

      const fp = roomFingerprint(toSave);
      if (fp === lastSavedFp.current) {
        setSaveStatus("saved");
        setSaveError(null);
        return;
      }

      if (inFlight.current) {
        pendingAfterFlight.current = true;
        return;
      }

      const payload = JSON.stringify({
        room: toSave,
        baseUpdatedAt: baseUpdatedAt.current,
      });
      const bytes = roomPayloadBytes(toSave);

      const gen = ++saveGen.current;
      inFlight.current = true;
      clearRetry();
      setSaveStatus("saving");
      setSaveError(null);

      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive,
        });
        if (res.status === 409) {
          // Someone else saved first. Pull their version in, merge, and the
          // merge saves on top. Only after repeated failures do we stop and
          // ask for a reload rather than risk overwriting their work.
          if (gen !== saveGen.current) return;
          pendingAfterFlight.current = false;
          clearRetry();
          if (++mergeRetries.current > MAX_MERGE_RETRIES) {
            conflicted.current = true;
            setSaveStatus("conflict");
            setSaveError(CONFLICT_MESSAGE);
          } else {
            needsSync.current = true;
          }
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          if (res.status === 413) {
            throw new Error(
              "Room is too large to save. Try fewer pieces or smaller images.",
            );
          }
          throw new Error(txt || `HTTP ${res.status}`);
        }

        const data = (await res.json().catch(() => null)) as {
          updatedAt?: string;
          room?: Room;
        } | null;

        // Stale response — a newer save superseded this one.
        if (gen !== saveGen.current) return;

        // Fingerprint of what we actually persisted — not the live room,
        // which may have newer edits (eye line, moves) made mid-save.
        lastSavedFp.current = fp;
        mergeRetries.current = 0;
        if (data?.updatedAt) baseUpdatedAt.current = data.updatedAt;
        baseRoom.current = data?.room ? mergeStoredImageUrls(toSave, data.room) : toSave;
        if (data?.room) {
          onRoomNormalizedRef.current?.(data.room);
        }
        retryDelay.current = RETRY_BASE_MS;
        setSaveStatus("saved");
        setSaveError(
          bytes > PAYLOAD_WARN_BYTES
            ? "Saved — room is getting large; consider fewer high-res images."
            : null,
        );
        void clearDraft(roomId);
        onSavedRef.current?.(data?.updatedAt ?? new Date().toISOString());

        // If the user edited while this save was in flight, queue another.
        if (roomFingerprint(roomRef.current) !== fp) {
          pendingAfterFlight.current = true;
        }
      } catch (e) {
        if (gen !== saveGen.current) return;
        console.error("Save failed", e);
        setSaveStatus("error");
        setSaveError(e instanceof Error ? e.message : "Save failed");
        const delay = retryDelay.current;
        retryDelay.current = Math.min(RETRY_MAX_MS, delay * 2);
        retryTimer.current = setTimeout(() => {
          void performSaveRef.current?.(roomRef.current);
        }, delay);
      } finally {
        if (gen === saveGen.current) {
          inFlight.current = false;
          if (needsSync.current) {
            needsSync.current = false;
            void syncWithServer().then((ok) => {
              if (ok) return;
              conflicted.current = true;
              setSaveStatus("conflict");
              setSaveError(CONFLICT_MESSAGE);
            });
          } else if (pendingAfterFlight.current) {
            pendingAfterFlight.current = false;
            const latest = roomRef.current;
            if (roomFingerprint(latest) !== lastSavedFp.current) {
              void performSaveRef.current?.(latest);
            }
          }
        }
      }
    },
    [roomId, clearRetry, syncWithServer],
  );

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  const checkRemote = useCallback(
    (serverUpdatedAt: string) => {
      if (!enabledRef.current || conflicted.current) return;
      if (inFlight.current || syncing.current) return; // next poll will catch it
      if (sameInstant(serverUpdatedAt, baseUpdatedAt.current)) return;
      void syncWithServer();
    },
    [syncWithServer],
  );

  const scheduleSave = useCallback(() => {
    if (!enabledRef.current || conflicted.current) return;
    if (roomFingerprint(roomRef.current) === lastSavedFp.current) return;

    setSaveStatus((s) => (s === "saving" ? s : "unsaved"));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void performSaveRef.current?.(roomRef.current);
    }, DEBOUNCE_MS);
  }, []);

  const flush = useCallback(() => {
    if (!enabledRef.current || conflicted.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const body = roomRef.current;
    if (roomFingerprint(body) === lastSavedFp.current) return;
    // Local draft survives tab crashes even when keepalive PATCH is dropped
    // (Chrome caps keepalive request bodies around 64KB).
    void saveDraft(roomId, body, baseUpdatedAt.current);
    void performSaveRef.current?.(body, { keepalive: true });
  }, [roomId]);

  // React to room edits.
  useEffect(() => {
    if (!enabled || conflicted.current) return;
    if (roomFingerprint(room) === lastSavedFp.current) return;

    setSaveStatus((s) => (s === "saving" ? s : "unsaved"));

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (conflicted.current) return;
      void saveDraft(roomId, roomRef.current, baseUpdatedAt.current);
    }, DRAFT_DEBOUNCE_MS);

    scheduleSave();
  }, [room, roomId, enabled, scheduleSave]);

  // Flush on tab hide / unload; also flush pending debounce on unmount.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      clearRetry();
      if (draftTimer.current) clearTimeout(draftTimer.current);
      flush();
    };
  }, [flush, clearRetry]);

  const retrySave = useCallback(() => {
    if (conflicted.current) {
      // The local copy is stale; drop its draft so the reload shows the
      // server version instead of re-applying the conflicting edits.
      void clearDraft(roomId).finally(() => window.location.reload());
      return;
    }
    retryDelay.current = RETRY_BASE_MS;
    clearRetry();
    void performSaveRef.current?.(roomRef.current);
  }, [clearRetry, roomId]);

  return { saveStatus, saveError, retrySave, markSaved, checkRemote };
}
