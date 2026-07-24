"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  reason?: string;
};

export function LoginForm({ reason }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "ログインに失敗しました");
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {reason === "required" ? (
        <p className="result-note" role="alert">
          ログインが必要です。認証後に管理画面へアクセスできます。
        </p>
      ) : null}
      {message ? (
        <p className="error-message" role="alert">
          {message}
        </p>
      ) : null}

      <form onSubmit={onSubmit}>
        <label className="field">
          メールアドレス
          <input
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          パスワード
          <input
            type="password"
            placeholder="••••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="button" type="submit" style={{ width: "100%" }} disabled={submitting}>
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </>
  );
}
