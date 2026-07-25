import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedOwner } from "@/lib/auth/server";
import {
  AUTH_ACTIVITY_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  AUTH_IDLE_TIMEOUT_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    accessToken?: unknown;
    refreshToken?: unknown;
  };
  const accessToken = String(body.accessToken ?? "");
  const refreshToken = String(body.refreshToken ?? "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !accessToken || !refreshToken) {
    return NextResponse.json({ message: "ログイン情報を確認できません" }, { status: 400 });
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user || !isAuthorizedOwner(data.user)) {
    return NextResponse.json({ message: "この利用者は承認されていません" }, { status: 403 });
  }

  const response = NextResponse.json({ message: "ログインしました" });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: AUTH_IDLE_TIMEOUT_SECONDS,
  };
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, cookieOptions);
  response.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
  response.cookies.set(
    AUTH_ACTIVITY_COOKIE_NAME,
    String(Math.floor(Date.now() / 1000)),
    cookieOptions,
  );
  return response;
}
