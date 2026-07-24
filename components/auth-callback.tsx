"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export function AuthCallback() {
  const [message, setMessage] = useState("ログインリンクを確認しています…");

  useEffect(() => {
    async function completeLogin() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) throw new Error("Supabase接続情報が未設定です");

      const client = createClient(url, anonKey, {
        auth: { persistSession: true, detectSessionInUrl: true },
      });
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) {
        throw new Error("ログインリンクを確認できませんでした");
      }
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: data.session.access_token }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ログインできませんでした");
      window.location.replace("/");
    }

    void completeLogin().catch((error) => {
      setMessage(error instanceof Error ? error.message : "ログインできませんでした");
    });
  }, []);

  return <p className="result-note" role="status">{message}</p>;
}
