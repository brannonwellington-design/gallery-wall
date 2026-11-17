import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_BUCKET = "room-images";

let client: SupabaseClient | null = null;

/**
 * Shared service-role client. Null when Supabase isn't configured (local
 * file-repo mode). The service-role key bypasses RLS, so this must only be
 * used from server code.
 */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Host of the configured Supabase project, used to recognize our own image URLs. */
export function supabaseHost(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
