import Link from "next/link";
import { getRepo } from "@/lib/repo";
import RoomEditor from "@/components/RoomEditor";

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
        title="Couldn't load room"
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 p-8">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-zinc-600 mb-4">{message}</p>
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to all rooms
        </Link>
      </div>
    </div>
  );
}
