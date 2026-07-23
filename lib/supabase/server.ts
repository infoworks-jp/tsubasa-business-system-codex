import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminJwt = process.env.SUPABASE_ADMIN_JWT;

  if (
    !url ||
    !anonKey ||
    url.includes("your-project") ||
    anonKey === "your-anon-key"
  ) {
    throw new SupabaseNotConfiguredError();
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: adminJwt ? { Authorization: `Bearer ${adminJwt}` } : undefined,
    },
  });
}
