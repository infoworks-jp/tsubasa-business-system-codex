import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const email = String(((await request.json()) as { email?: unknown }).email ?? "").trim();
    if (!email) {
      return NextResponse.json({ message: "メールアドレスを入力してください" }, { status: 400 });
    }

    const client = createAuthClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    });
    if (error) {
      // 利用者の存在を第三者に知らせない。
      console.warn("Magic-link request was not accepted by Supabase Auth");
    }
    return NextResponse.json({
      message: "承認済みアドレスの場合、ログインリンクを送信しました",
    });
  } catch {
    return NextResponse.json({ message: "ログインリンクを送信できませんでした" }, { status: 500 });
  }
}
