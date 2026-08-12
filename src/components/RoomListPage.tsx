"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { formatAbsolute, formatEditedLabel } from "@/lib/dates";
import type { RoomSummary } from "@/lib/types";
import BrandedHeader from "./BrandedHeader";
import LocalTime from "./LocalTime";

type Props = {
  initialRooms: RoomSummary[];
  platformUpdatedAt: string;
};

export default function RoomListPage({
  initialRooms,
  platformUpdatedAt,
}: Props) {
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
    if (!confirm(`Delete “${name}”? This can’t be undone.`)) return;
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function duplicateRoom(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate");
    }
  }

  const count = initialRooms.length;

  return (
    <div className="min-h-screen bg-surface-primary text-content-secondary">
      <BrandedHeader title="Gallery Wall" />

      <main className="max-w-[800px] mx-auto px-12 md:px-12 pt-24 pb-24">
        {/* Title-block lockup */}
        <header className="pb-12">
          <div className="text-[10px] leading-4 text-content-disabled mb-2">
            Index
          </div>
          <h1 className="text-[48px] leading-[52px] text-content-primary mb-3">
            Gallery Wall
          </h1>
          <p className="text-[16px] leading-6 text-content-secondary mb-6 max-w-[560px]">
            Plan gallery walls to scale. Drop in your art, set the wall
            dimensions, and arrange pieces against an eye-level guide.
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-content-disabled tabular">
            <span>
              {count} {count === 1 ? "room" : "rooms"}
            </span>
            <span aria-hidden="true">·</span>
            <span title="Commit time of the currently deployed build">
              Platform updated{" "}
              <LocalTime iso={platformUpdatedAt} />
            </span>
          </div>
        </header>

        {/* Hairline divider — brand pattern for section breaks */}
        <div className="h-px bg-content-disabled mb-8" aria-hidden="true" />

        {error && (
          <div className="mb-8 p-4 border-l-2 border-surface-negative-primary bg-surface-negative-secondary text-[14px] leading-5 text-content-primary">
            {error}
          </div>
        )}

        {initialRooms.length === 0 ? (
          <div className="py-16">
            <p className="text-[24px] leading-7 text-content-primary mb-3">
              No rooms yet.
            </p>
            <p className="text-[16px] leading-6 text-content-secondary mb-8 max-w-[480px]">
              Start a new room to plan its layout. You can paste a Society6 or
              Etsy URL and it will pull in size and image for you.
            </p>
            <NewRoomButton onClick={createRoom} disabled={creating} creating={creating} />
          </div>
        ) : (
          <>
            <ul className="border-t border-surface-tertiary">
              {initialRooms.map((room) => (
                <li
                  key={room.id}
                  className="flex items-center gap-4 py-4 border-b border-surface-tertiary"
                >
                  <Link
                    href={`/rooms/${room.id}`}
                    className="flex-1 min-w-0 flex flex-col gap-1 rounded-sm"
                  >
                    <span className="text-[16px] leading-6 text-content-primary truncate">
                      {room.name || "Untitled room"}
                    </span>
                    <span
                      className="text-[12px] leading-4 text-content-disabled tabular"
                      title={formatAbsolute(room.updatedAt)}
                    >
                      {room.itemCount}{" "}
                      {room.itemCount === 1 ? "piece" : "pieces"}
                      {" · "}
                      {formatEditedLabel(room.updatedAt)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => duplicateRoom(room.id)}
                    disabled={pending}
                    className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-md text-content-secondary hover:text-content-primary hover:bg-surface-secondary disabled:opacity-50"
                    aria-label={`Duplicate ${room.name || "Untitled room"}`}
                    title="Duplicate room"
                  >
                    <Copy size={16} strokeWidth={1.25} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      deleteRoom(room.id, room.name || "Untitled room")
                    }
                    disabled={pending}
                    className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-md text-content-secondary hover:text-content-negative hover:bg-surface-secondary disabled:opacity-50"
                    aria-label={`Delete ${room.name || "Untitled room"}`}
                    title="Delete room"
                  >
                    <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <NewRoomButton
                onClick={createRoom}
                disabled={creating}
                creating={creating}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NewRoomButton({
  onClick,
  disabled,
  creating,
}: {
  onClick: () => void;
  disabled: boolean;
  creating: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-8 px-4 rounded-lg bg-surface-brand-primary text-content-brand-contrast text-[14px] leading-5 hover:opacity-90 disabled:opacity-50"
    >
      <Plus size={16} strokeWidth={1.25} aria-hidden="true" />
      {creating ? "Creating…" : "New room"}
    </button>
  );
}
