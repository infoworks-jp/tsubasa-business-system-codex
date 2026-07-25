"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
      const client = getSupabaseBrowserClient();
      const { data, error } = await client.auth.getSession();
      if (
        error ||
        !data.session?.access_token ||
        !data.session.refresh_token
      ) {
        throw new Error("ログインリンクを確認できませんでした");
      }
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        }),
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
