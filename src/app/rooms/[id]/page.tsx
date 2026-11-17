import Link from "next/link";
import { getRepo } from "@/lib/repo";
import RoomEditor from "@/components/RoomEditor";
import BrandedHeader from "@/components/BrandedHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

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

  return (
    <RoomEditor
      roomId={id}
      initialRoom={record.room}
      initialUpdatedAt={record.updatedAt}
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
        <Button asChild>
          <Link href="/">Back to rooms</Link>
        </Button>
      </main>
    </div>
  );
}
