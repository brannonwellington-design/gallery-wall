"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PresenceEntry } from "@/lib/presence";

const VISIBLE_MS = 3000;
const HIDDEN_MS = 15000;
const NAME_KEY = "gw-name";

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() || "Guest";
  } catch {
    return "Guest";
  }
}

/**
 * Presence + live updates for one room. Checks in on an interval (faster
 * while the tab is visible), reports this editor's selection, and hands the
 * server's current updatedAt to `onServerVersion` so autosave can pull in
 * other people's saves.
 */
export function useCollaboration({
  roomId,
  selection,
  enabled,
  onServerVersion,
}: {
  roomId: string;
  selection: string[];
  enabled: boolean;
  onServerVersion: (updatedAt: string) => void;
}) {
  const [others, setOthers] = useState<PresenceEntry[]>([]);
  const [name, setNameState] = useState("Guest");
  const sessionId = useRef<string>("");
  const selectionRef = useRef(selection);
  const nameRef = useRef(name);
  const onVersionRef = useRef(onServerVersion);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectionRef.current = selection;
    onVersionRef.current = onServerVersion;
    nameRef.current = name;
  });

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNameState(readName());
  }, []);

  const checkIn = useCallback(async () => {
    if (!sessionId.current) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          name: nameRef.current,
          selection: selectionRef.current,
        }),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { updatedAt: string; others: PresenceEntry[] };
      setOthers(data.others);
      onVersionRef.current(data.updatedAt);
    } catch {
      // Offline or a blip — try again on the next tick.
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const loop = async () => {
      await checkIn();
      if (stopped) return;
      timer.current = setTimeout(loop, document.visibilityState === "visible" ? VISIBLE_MS : HIDDEN_MS);
    };
    void loop();
    // Check in right away when the tab comes back to the front.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer.current) clearTimeout(timer.current);
      void loop();
    };
    const leave = () => {
      const blob = new Blob(
        [JSON.stringify({ sessionId: sessionId.current, leaving: true })],
        { type: "application/json" },
      );
      navigator.sendBeacon?.(`/api/rooms/${roomId}/presence`, blob);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", leave);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [enabled, checkIn, roomId]);

  // Share selection changes promptly rather than on the next tick.
  const selectionKey = selection.join(",");
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void checkIn(), 150);
    return () => clearTimeout(t);
  }, [selectionKey, enabled, checkIn]);

  const setName = useCallback(
    (next: string) => {
      const clean = next.trim().slice(0, 40) || "Guest";
      try {
        localStorage.setItem(NAME_KEY, clean);
      } catch {
        // Private mode: keep it for this tab only.
      }
      setNameState(clean);
      nameRef.current = clean;
      void checkIn();
    },
    [checkIn],
  );

  return { others, name, setName };
}
