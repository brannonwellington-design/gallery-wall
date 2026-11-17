"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { formatAbsolute, formatEditedLabel } from "@/lib/dates";
import type { RoomSummary } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  Platform updated{" "}
                  <LocalTime iso={platformUpdatedAt} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Commit time of the currently deployed build
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <Separator className="mb-8 bg-content-disabled" />

        {error ? (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[12px] leading-4 text-content-disabled tabular">
                          {room.itemCount}{" "}
                          {room.itemCount === 1 ? "piece" : "pieces"}
                          {" · "}
                          {formatEditedLabel(room.updatedAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatAbsolute(room.updatedAt)}
                      </TooltipContent>
                    </Tooltip>
                  </Link>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-content-secondary"
                        onClick={() => duplicateRoom(room.id)}
                        disabled={pending}
                        aria-label={`Duplicate ${room.name || "Untitled room"}`}
                      >
                        <Copy size={16} strokeWidth={1.25} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate room</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-content-secondary hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setPendingDelete({
                            id: room.id,
                            name: room.name || "Untitled room",
                          })
                        }
                        disabled={pending}
                        aria-label={`Delete ${room.name || "Untitled room"}`}
                      >
                        <Trash2 size={16} strokeWidth={1.25} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete room</TooltipContent>
                  </Tooltip>
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

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room</AlertDialogTitle>
            <AlertDialogDescription>
              Delete “{pendingDelete?.name}”? This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <Button type="button" onClick={onClick} disabled={disabled}>
      <Plus size={16} strokeWidth={1.25} aria-hidden="true" />
      {creating ? "Creating…" : "New room"}
    </Button>
  );
}
