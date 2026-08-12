import Link from "next/link";
import { externalizeRoomImages } from "@/lib/imageStore";
import { getRepo } from "@/lib/repo";
import RoomEditor from "@/components/RoomEditor";
import BrandedHeader from "@/components/BrandedHeader";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let record;
  try {
    record = await getRepo().get(id);
  } catch (e) {
    return (
      <ErrorScreen
        title="Couldn’t load room"
        message={e instanceof Error ? e.message : "Unknown error"}
      />
    );
  }

  if (!record) {
    return (
      <ErrorScreen
        title="Room not found"
        message="This room may have been deleted."
      />
    );
  }

  // Move any leftover base64 images into Storage so the editor starts with
  // a lean room (and so subsequent autosaves fit under Vercel's body limit).
  let room = record.room;
  let updatedAt = record.updatedAt;
  try {
    const migrated = await externalizeRoomImages(id, room);
    if (migrated.changed) {
      room = migrated.room;
      ({ updatedAt } = await getRepo().update(id, room));
    }
  } catch (e) {
    console.error("[room-page] image migration failed", e);
  }

  return (
    <RoomEditor
      roomId={id}
      initialRoom={room}
      initialUpdatedAt={updatedAt}
    />
  );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-surface-primary text-content-secondary">
      <BrandedHeader title="Gallery Wall" />
      <main className="max-w-[800px] mx-auto px-12 pt-32 pb-24">
        <div className="text-[10px] leading-4 text-content-disabled mb-2">
          Error
        </div>
        <h1 className="text-[48px] leading-[52px] text-content-primary mb-3">
          {title}
        </h1>
        <p className="text-[16px] leading-6 text-content-secondary mb-6 max-w-[560px]">
          {message}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1 h-8 px-4 rounded-lg bg-surface-brand-primary text-content-brand-contrast text-[14px] leading-5 hover:opacity-90"
        >
          Back to rooms
        </Link>
      </main>
    </div>
  );
}
