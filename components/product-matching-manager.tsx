"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Product = { id: string; product_name: string };
type Alias = { id: string; source_name: string; product_id: string };
type MatchRow = {
  id: string;
  original_product_name: string | null;
  product_name: string;
  product_id: string | null;
  status: string;
  sales_confirmed_at: string | null;
  recorded_at: string | null;
};

export function ProductMatchingManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [aliasProductId, setAliasProductId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.product_name])),
    [products],
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/product-matching", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "商品照合情報を取得できません");
    setProducts(body.products);
    setAliases(body.aliases);
    setRows(body.rows);
  }, []);

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "取得失敗"));
  }, [load]);

  async function addAlias(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/product-matching/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceName, productId: aliasProductId }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || "登録できません");
      return;
    }
    setSourceName("");
    setAliasProductId("");
    setMessage("表記ゆれ対応を登録しました");
    await load();
  }

  async function archiveAlias(alias: Alias) {
    const reason = window.prompt(`${alias.source_name} のアーカイブ理由を入力してください`);
    if (reason === null) return;
    const response = await fetch(`/api/product-matching/aliases/${alias.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || "アーカイブできません");
      return;
    }
    setMessage(body.message);
    await load();
  }

  async function confirmRow(row: MatchRow, form: HTMLFormElement) {
    const formData = new FormData(form);
    const productId = String(formData.get("productId") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const recordedAt = String(formData.get("recordedAt") ?? "");
    const confirmSales = formData.get("confirmSales") === "on";
    const response = await fetch(`/api/product-matching/rows/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, reason, recordedAt, confirmSales }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || "更新できません");
      return;
    }
    setMessage(body.message);
    await load();
  }

  return (
    <div className="grid source-file-sections">
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      <form className="card product-form" onSubmit={addAlias}>
        <section className="form-section">
          <h2>表記ゆれ対応を人が登録</h2>
          <div className="form-grid">
            <label className="field">
              <span>OCR商品名の原文</span>
              <input onChange={(event) => setSourceName(event.target.value)} value={sourceName} />
            </label>
            <label className="field">
              <span>確認済み商品</span>
              <select onChange={(event) => setAliasProductId(event.target.value)} value={aliasProductId}>
                <option value="">商品を選択</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.product_name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <div className="form-actions">
          <button className="button" type="submit">対応を登録</button>
        </div>
      </form>

      <section className="card panel">
        <div className="panel-head"><h2>表記ゆれ対応表</h2><span className="status">{aliases.length}件</span></div>
        <div className="list">
          {aliases.map((alias) => (
            <div className="list-row" key={alias.id}>
              <span><strong>{alias.source_name}</strong> → {productNames.get(alias.product_id) ?? "要確認"}</span>
              <button className="text-button" onClick={() => archiveAlias(alias)} type="button">アーカイブ</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card panel">
        <div className="panel-head"><h2>OCR商品照合・売上確認</h2><span className="status">{rows.length}件</span></div>
        <div className="list">
          {rows.map((row) => (
            <form
              className="list-row matching-row"
              key={row.id}
              onSubmit={(event) => {
                event.preventDefault();
                confirmRow(row, event.currentTarget);
              }}
            >
              <div>
                <strong>{row.original_product_name ?? row.product_name}</strong>
                <p className="muted">現在: {row.product_id ? productNames.get(row.product_id) : "要確認"} / 売上: {row.sales_confirmed_at ? "確認済み" : "未確認"}</p>
              </div>
              <div className="matching-fields">
                <select defaultValue={row.product_id ?? ""} name="productId">
                  <option value="">要確認</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}
                </select>
                <input defaultValue={row.recorded_at ?? ""} name="recordedAt" placeholder="元日時（ISO、任意）" />
                <input name="reason" placeholder="変更理由（必須）" />
                <label><input name="confirmSales" type="checkbox" /> 売上確認済み</label>
                <button className="button" type="submit">更新</button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
