import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url.includes("your-project") ||
    anonKey === "your-anon-key"
  ) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set real values only when connection is approved.",
    );
  }

  browserClient ??= createClient(url, anonKey);
  return browserClient;
}
