import { getRepo } from "@/lib/repo";
import { getBuildInfo } from "@/lib/buildInfo";
import RoomListPage from "@/components/RoomListPage";
import BrandedHeader from "@/components/BrandedHeader";
import LocalTime from "@/components/LocalTime";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { commitDate } = getBuildInfo();

  let rooms;
  try {
    rooms = await getRepo().list();
  } catch (e) {
    return (
      <div className="min-h-screen bg-surface-primary text-content-secondary">
        <BrandedHeader title="Gallery Wall" />
        <main className="max-w-[800px] mx-auto px-12 pt-32 pb-24">
          <div className="text-caption text-content-disabled mb-2">
            Error
          </div>
          <h1 className="text-display text-content-primary mb-3">
            Couldn’t load rooms
          </h1>
          <Alert variant="destructive" className="mb-4 max-w-[560px]">
            <AlertDescription>
              {e instanceof Error ? e.message : "Unknown error"}
            </AlertDescription>
          </Alert>
          <p className="text-label text-content-disabled max-w-[560px]">
            Check the Supabase configuration in <span className="tabular">.env.local</span>,
            or unset the env vars to fall back to local file storage.
          </p>
          <p className="mt-6 text-label text-content-disabled tabular">
            <LocalTime iso={commitDate} prefix="Platform updated " />
          </p>
        </main>
      </div>
    );
  }
  return (
    <RoomListPage
      initialRooms={rooms}
      platformUpdatedAt={commitDate}
    />
  );
}
