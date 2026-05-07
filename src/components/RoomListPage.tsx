"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { RoomSummary } from "@/lib/types";

type Props = {
  initialRooms: RoomSummary[];
};

export default function RoomListPage({ initialRooms }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const { id } = (await res.json()) as { id: string };
      router.push(`/rooms/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
      setCreating(false);
    }
  }

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Gallery Wall</h1>
          <button
            type="button"
            onClick={createRoom}
            disabled={creating}
            className="bg-zinc-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "+ New room"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {initialRooms.length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-12 text-center text-zinc-500">
            <p className="text-base mb-2">No rooms yet.</p>
            <p className="text-sm">Click &ldquo;+ New room&rdquo; to start planning a gallery wall.</p>
          </div>
        ) : (
          <ul className="bg-white rounded-lg border border-zinc-200 divide-y divide-zinc-200 overflow-hidden">
            {initialRooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 group"
              >
                <Link
                  href={`/rooms/${room.id}`}
                  className="flex-1 min-w-0 flex items-baseline gap-3"
                >
                  <span className="text-base font-medium text-zinc-900 truncate">
                    {room.name || "Untitled room"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {room.itemCount} {room.itemCount === 1 ? "piece" : "pieces"}
                  </span>
                </Link>
                <span className="text-xs text-zinc-400 shrink-0">
                  {formatRelative(room.updatedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteRoom(room.id, room.name || "Untitled room")}
                  disabled={pending}
                  className="text-zinc-400 hover:text-red-600 text-sm px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete ${room.name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
