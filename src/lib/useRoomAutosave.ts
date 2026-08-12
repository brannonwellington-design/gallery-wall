"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "./types";
import {
  externalizeRoomImagesClient,
  roomExceedsPatchLimit,
  roomPayloadBytes,
} from "./externalizeClient";
import { clearDraft, saveDraft } from "./roomDraft";
import { roomFingerprint } from "./roomFingerprint";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 500;
const DRAFT_DEBOUNCE_MS = 200;
const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 15000;
/** Soft warn around Vercel Hobby body limits (~4.5 MB). */
const PAYLOAD_WARN_BYTES = 3_500_000;

type Options = {
  roomId: string;
  room: Room;
  /** When false, skip server saves (e.g. while restoring a local draft). */
  enabled?: boolean;
  /** Called after a successful server save with the new updatedAt. */
  onSaved?: (updatedAt: string) => void;
  /**
   * Called when inline images were uploaded to Storage so the editor can
   * swap data URLs for https URLs without treating it as a user edit.
   */
  onRoomNormalized?: (room: Room) => void;
};

type SaveFn = (
  body: Room,
  opts?: { keepalive?: boolean },
) => Promise<void>;

export function useRoomAutosave({
  roomId,
  room,
  enabled = true,
  onSaved,
  onRoomNormalized,
}: Options): {
  saveStatus: SaveStatus;
  saveError: string | null;
  retrySave: () => void;
  markSaved: (r: Room) => void;
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
      if (!enabledRef.current) return;

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
          void saveDraft(roomId, toSave);
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

      const payload = JSON.stringify({ room: toSave });
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
          if (pendingAfterFlight.current) {
            pendingAfterFlight.current = false;
            const latest = roomRef.current;
            if (roomFingerprint(latest) !== lastSavedFp.current) {
              void performSaveRef.current?.(latest);
            }
          }
        }
      }
    },
    [roomId, clearRetry],
  );

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  const scheduleSave = useCallback(() => {
    if (!enabledRef.current) return;
    if (roomFingerprint(roomRef.current) === lastSavedFp.current) return;

    setSaveStatus((s) => (s === "saving" ? s : "unsaved"));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void performSaveRef.current?.(roomRef.current);
    }, DEBOUNCE_MS);
  }, []);

  const flush = useCallback(() => {
    if (!enabledRef.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const body = roomRef.current;
    if (roomFingerprint(body) === lastSavedFp.current) return;
    // Local draft survives tab crashes even when keepalive PATCH is dropped
    // (Chrome caps keepalive request bodies around 64KB).
    void saveDraft(roomId, body);
    void performSaveRef.current?.(body, { keepalive: true });
  }, [roomId]);

  // React to room edits.
  useEffect(() => {
    if (!enabled) return;
    if (roomFingerprint(room) === lastSavedFp.current) return;

    setSaveStatus((s) => (s === "saving" ? s : "unsaved"));

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void saveDraft(roomId, roomRef.current);
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
    retryDelay.current = RETRY_BASE_MS;
    clearRetry();
    void performSaveRef.current?.(roomRef.current);
  }, [clearRetry]);

  return { saveStatus, saveError, retrySave, markSaved };
}
