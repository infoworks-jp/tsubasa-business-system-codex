"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type AuthCallbackProps = {
  required?: boolean;
};

export function AuthCallback({ required = false }: AuthCallbackProps) {
  const [message, setMessage] = useState<string | null>(
    required ? "ログインリンクを確認しています…" : null,
  );

  useEffect(() => {
    async function completeLogin() {
      const hasAuthResponse =
        window.location.hash.includes("access_token=") ||
        window.location.search.includes("code=");
      if (!hasAuthResponse) {
        if (required) setMessage("ログインリンクを確認できませんでした");
        return;
      }
      setMessage("ログインリンクを確認しています…");
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
  }, [required]);

  return message ? <p className="result-note" role="status">{message}</p> : null;
}
