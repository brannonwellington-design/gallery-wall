import { getRepo } from "@/lib/repo";
import RoomListPage from "@/components/RoomListPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  let rooms;
  try {
    rooms = await getRepo().list();
  } catch (e) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Couldn&apos;t load rooms</h1>
          <p className="text-sm text-zinc-600 mb-4">
            {e instanceof Error ? e.message : "Unknown error"}
          </p>
          <p className="text-xs text-zinc-500">
            Check the Supabase configuration in .env.local, or unset the env vars to fall back to local file storage.
          </p>
        </div>
      </div>
    );
  }
  return <RoomListPage initialRooms={rooms} />;
}
