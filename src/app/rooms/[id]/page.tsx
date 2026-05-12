import Link from "next/link";
import { getRepo } from "@/lib/repo";
import RoomEditor from "@/components/RoomEditor";
import BrandedHeader from "@/components/BrandedHeader";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let room;
  try {
    room = await getRepo().get(id);
  } catch (e) {
    return (
      <ErrorScreen
        title="Couldn’t load room"
        message={e instanceof Error ? e.message : "Unknown error"}
      />
    );
  }

  if (!room) {
    return (
      <ErrorScreen
        title="Room not found"
        message="This room may have been deleted."
      />
    );
  }

  return <RoomEditor roomId={id} initialRoom={room} />;
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
