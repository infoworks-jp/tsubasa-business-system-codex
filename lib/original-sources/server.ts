import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/server";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export function getAuthenticatedSupabaseClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!url || !anonKey || url.includes("your-project") || anonKey === "your-anon-key") {
    throw new SupabaseNotConfiguredError();
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
