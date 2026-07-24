import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_NAME, isAuthorizedOwner } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  const accessToken = String(
    ((await request.json()) as { accessToken?: unknown }).accessToken ?? "",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !accessToken) {
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
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
