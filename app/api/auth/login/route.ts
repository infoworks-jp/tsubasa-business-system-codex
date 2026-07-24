import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_NAME } from "@/lib/auth/server";

function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("your-project") || anonKey === "your-anon-key") {
    throw new Error("Supabase接続情報が未設定です");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ message: "メールアドレスとパスワードを入力してください" }, { status: 400 });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session?.access_token) {
      return NextResponse.json({ message: "ログインに失敗しました。認証情報を確認してください" }, { status: 401 });
    }

    const response = NextResponse.json({
      message: "ログインしました",
      user: {
        id: data.user.id,
        email: data.user.email ?? "",
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: data.session.expires_in ?? 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ message: "ログイン処理に失敗しました" }, { status: 500 });
  }
}
