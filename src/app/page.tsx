import { getRepo } from "@/lib/repo";
import RoomListPage from "@/components/RoomListPage";
import BrandedHeader from "@/components/BrandedHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  let rooms;
  try {
    rooms = await getRepo().list();
  } catch (e) {
    return (
      <div className="min-h-screen bg-surface-primary text-content-secondary">
        <BrandedHeader title="Gallery Wall" />
        <main className="max-w-[800px] mx-auto px-12 pt-32 pb-24">
          <div className="text-[10px] leading-4 text-content-disabled mb-2">
            Error
          </div>
          <h1 className="text-[48px] leading-[52px] text-content-primary mb-3">
            Couldn’t load rooms
          </h1>
          <p className="text-[16px] leading-6 text-content-secondary mb-4 max-w-[560px]">
            {e instanceof Error ? e.message : "Unknown error"}
          </p>
          <p className="text-[12px] leading-4 text-content-disabled max-w-[560px]">
            Check the Supabase configuration in <span className="tabular">.env.local</span>,
            or unset the env vars to fall back to local file storage.
          </p>
        </main>
      </div>
    );
  }
  return <RoomListPage initialRooms={rooms} />;
}
