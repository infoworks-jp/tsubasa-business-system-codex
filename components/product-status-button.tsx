"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductStatusButton({
  productId,
  active,
}: {
  productId: string;
  active: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function updateStatus() {
    const action = active ? "無効化" : "再有効化";
    if (!window.confirm(`この商品を${action}します。よろしいですか？`)) return;
    const deactivationReason = active
      ? window.prompt("無効化理由を入力してください（任意）", "")?.trim() ?? ""
      : null;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !active,
          deactivationReason: active ? deactivationReason || null : null,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || `${action}に失敗しました`);
      setMessage(result.message || `${action}しました`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action}に失敗しました`);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-action">
      <button
        className="text-button"
        disabled={pending}
        onClick={updateStatus}
        type="button"
      >
        {pending ? "処理中…" : active ? "無効化" : "再有効化"}
      </button>
      {message && <span className="sr-only" role="status">{message}</span>}
    </span>
  );
}
