import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseConfig } from "@/lib/config";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

