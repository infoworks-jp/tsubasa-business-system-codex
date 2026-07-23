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
  const [confirming, setConfirming] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState("");
  const router = useRouter();

  async function updateStatus() {
    const action = active ? "無効化" : "再有効化";
    setPending(true);
    setConfirming(false);
    setMessage("");
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !active,
          deactivationReason: active ? deactivationReason.trim() || null : null,
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
        onClick={() => {
          setDeactivationReason("");
          setConfirming(true);
        }}
        type="button"
      >
        {pending ? "処理中…" : active ? "無効化" : "再有効化"}
      </button>
      {message && <span className="sr-only" role="status">{message}</span>}

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby={`status-dialog-title-${productId}`}
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <p className="eyebrow">Status change</p>
            <h2 id={`status-dialog-title-${productId}`}>
              {active ? "この商品を無効化しますか？" : "この商品を再有効化しますか？"}
            </h2>

            {active ? (
              <label className="field" style={{ marginTop: "0.75rem" }}>
                <span>無効化理由（任意）</span>
                <input
                  value={deactivationReason}
                  onChange={(event) => setDeactivationReason(event.target.value)}
                />
              </label>
            ) : null}

            <div className="form-actions">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => setConfirming(false)}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="button"
                disabled={pending}
                onClick={updateStatus}
                type="button"
              >
                {pending ? "処理中…" : active ? "無効化する" : "再有効化する"}
              </button>
            </div>
          </section>
        </div>
      )}
    </span>
  );
}
