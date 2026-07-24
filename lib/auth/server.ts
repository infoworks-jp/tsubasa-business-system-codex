import "server-only";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const AUTH_COOKIE_NAME = "sb-access-token";

export class AuthRequiredError extends Error {
  constructor(message = "ログインが必要です") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

function createSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("your-project") || anonKey === "your-anon-key") {
    throw new Error("Supabase接続情報が未設定です");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserByAccessToken(accessToken: string): Promise<User | null> {
  if (!accessToken) return null;

  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentUserFromCookie(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
  return getUserByAccessToken(accessToken);
}

export async function requireAuthenticatedApiUser(request: NextRequest): Promise<User> {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const user = await getUserByAccessToken(accessToken);
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}
