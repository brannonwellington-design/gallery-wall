import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Room, RoomSummary } from "./types";
import { makeDefaultRoom } from "./defaults";

export interface RoomsRepo {
  list(): Promise<RoomSummary[]>;
  get(id: string): Promise<Room | null>;
  create(room?: Partial<Room>): Promise<{ id: string }>;
  update(id: string, room: Room): Promise<void>;
  remove(id: string): Promise<void>;
}

let cached: RoomsRepo | null = null;

export function getRepo(): RoomsRepo {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    cached = new SupabaseRepo(url, key);
  } else {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[rooms-repo] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using file-backed repo at data/rooms.json (dev only).",
      );
    }
    cached = new FileRepo();
  }
  return cached;
}

// ---- Supabase ----

const TABLE = "rooms";

class SupabaseRepo implements RoomsRepo {
  private client: SupabaseClient;
  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  async list(): Promise<RoomSummary[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("id, name, data, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? "Untitled room",
      itemCount: Array.isArray(row.data?.items) ? row.data.items.length : 0,
      updatedAt: row.updated_at as string,
    }));
  }
  async get(id: string): Promise<Room | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("id, name, data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const body = data.data ?? {};
    return {
      name: (data.name as string) ?? "Untitled room",
      wallWidth: body.wallWidth,
      wallHeight: body.wallHeight,
      unit: body.unit,
      items: Array.isArray(body.items) ? body.items : [],
    };
  }
  async create(partial?: Partial<Room>): Promise<{ id: string }> {
    const room = { ...makeDefaultRoom(), ...partial };
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ name: room.name, data: stripName(room) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data!.id as string };
  }
  async update(id: string, room: Room): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .update({
        name: room.name,
        data: stripName(room),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  async remove(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

function stripName(room: Room) {
  // The `name` is its own column; the rest goes into the JSONB `data`.
  const { name, ...rest } = room;
  void name;
  return rest;
}

// ---- File-backed (dev fallback) ----

type FileShape = {
  rooms: Record<
    string,
    {
      id: string;
      name: string;
      data: Omit<Room, "name">;
      created_at: string;
      updated_at: string;
    }
  >;
};

class FileRepo implements RoomsRepo {
  private file = path.join(process.cwd(), "data", "rooms.json");
  private writing: Promise<void> = Promise.resolve();

  private async read(): Promise<FileShape> {
    try {
      const text = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.rooms) return parsed;
    } catch {
      // missing or unreadable — start empty
    }
    return { rooms: {} };
  }

  private async write(shape: FileShape): Promise<void> {
    const dir = path.dirname(this.file);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(shape, null, 2));
  }

  private async mutate(fn: (shape: FileShape) => void): Promise<void> {
    // Serialise writes so concurrent updates don't clobber each other.
    this.writing = this.writing.then(async () => {
      const shape = await this.read();
      fn(shape);
      await this.write(shape);
    });
    await this.writing;
  }

  async list(): Promise<RoomSummary[]> {
    const shape = await this.read();
    return Object.values(shape.rooms)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((r) => ({
        id: r.id,
        name: r.name,
        itemCount: r.data.items.length,
        updatedAt: r.updated_at,
      }));
  }

  async get(id: string): Promise<Room | null> {
    const shape = await this.read();
    const r = shape.rooms[id];
    if (!r) return null;
    return { name: r.name, ...r.data };
  }

  async create(partial?: Partial<Room>): Promise<{ id: string }> {
    const room = { ...makeDefaultRoom(), ...partial };
    const id = newId();
    const now = new Date().toISOString();
    await this.mutate((shape) => {
      shape.rooms[id] = {
        id,
        name: room.name,
        data: stripName(room) as Omit<Room, "name">,
        created_at: now,
        updated_at: now,
      };
    });
    return { id };
  }

  async update(id: string, room: Room): Promise<void> {
    await this.mutate((shape) => {
      const existing = shape.rooms[id];
      if (!existing) throw new Error("Room not found");
      existing.name = room.name;
      existing.data = stripName(room) as Omit<Room, "name">;
      existing.updated_at = new Date().toISOString();
    });
  }

  async remove(id: string): Promise<void> {
    await this.mutate((shape) => {
      delete shape.rooms[id];
    });
  }
}

function newId(): string {
  // 22-char URL-safe id. Good enough for a 2-user prototype; not a UUID.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes).toString("base64url");
}
