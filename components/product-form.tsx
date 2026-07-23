"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_CATEGORIES, type Product } from "@/lib/products/types";
import { productInputSchema, validationErrors } from "@/lib/products/validation";

type FieldErrors = Record<string, string[] | undefined>;

const emptyForm = {
  productCode: "",
  productName: "",
  category: "",
  ticketButtonNumber: "",
  ticketDisplayPosition: "",
  salesStartDate: "",
  salesEndDate: "",
  standardPrice: "",
  futureCost: "",
  isActive: true,
  priceChangeReason: "",
  priceValidFrom: "",
};

export function ProductForm({
  mode,
  product,
}: {
  mode: "create" | "edit";
  product?: Product;
}) {
  const router = useRouter();
  const initial = useMemo(
    () =>
      product
        ? {
            productCode: product.productCode,
            productName: product.productName,
            category: product.category,
            ticketButtonNumber: product.ticketButtonNumber ?? "",
            ticketDisplayPosition: product.ticketDisplayPosition ?? "",
            salesStartDate: product.salesStartDate,
            salesEndDate: product.salesEndDate ?? "",
            standardPrice: String(product.standardPrice),
            futureCost:
              product.futureCost === null ? "" : String(product.futureCost),
            isActive: product.isActive,
            priceChangeReason: "",
            priceValidFrom: "",
          }
        : emptyForm,
    [product],
  );
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();

  const priceChanged =
    mode === "edit" &&
    product &&
    Number(form.standardPrice) !== product.standardPrice;

  function payload() {
    return {
      ...form,
      category: form.category,
      standardPrice: form.standardPrice === "" ? Number.NaN : Number(form.standardPrice),
      futureCost: form.futureCost === "" ? null : Number(form.futureCost),
      salesEndDate: form.salesEndDate,
      ticketButtonNumber: form.ticketButtonNumber,
      ticketDisplayPosition: form.ticketDisplayPosition,
      isActive: form.isActive,
    };
  }

  function validate() {
    const result = productInputSchema.safeParse(payload());
    const nextErrors: FieldErrors = result.success
      ? {}
      : validationErrors(result.error);
    if (priceChanged && !form.priceValidFrom) {
      nextErrors.priceValidFrom = ["価格変更時は価格適用日が必須です"];
    }
    if (priceChanged && !form.priceChangeReason.trim()) {
      nextErrors.priceChangeReason = ["価格変更理由を入力してください"];
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({ type: "error", message: "入力内容を確認してください" });
      return false;
    }
    return true;
  }

  function requestConfirmation(event: React.FormEvent) {
    event.preventDefault();
    setNotice(undefined);
    if (validate()) setConfirming(true);
  }

  async function save() {
    if (pending || !validate()) return;
    setPending(true);
    setConfirming(false);
    try {
      const response = await fetch(
        mode === "create" ? "/api/products" : `/api/products/${product?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const result = (await response.json()) as {
        message?: string;
        fieldErrors?: FieldErrors;
      };
      if (!response.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        throw new Error(result.message || "保存に失敗しました");
      }
      const successMessage = result.message || "保存しました";
      setNotice({
        type: "success",
        message: successMessage,
      });
      router.push(`/products?saved=${encodeURIComponent(successMessage)}`);
      router.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "保存に失敗しました",
      });
    } finally {
      setPending(false);
    }
  }

  function field(
    name: keyof typeof form,
    label: string,
    input: React.ReactNode,
    required = false,
  ) {
    return (
      <label className="field">
        <span>
          {label}
          {required && <span className="required">必須</span>}
        </span>
        {input}
        {errors[name]?.map((error) => (
          <span className="field-error" key={error}>{error}</span>
        ))}
      </label>
    );
  }

  const set = (name: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  return (
    <>
      {notice && (
        <div className={`notice ${notice.type}`} role="alert">
          {notice.message}
        </div>
      )}
      <form className="card product-form" onSubmit={requestConfirmation} noValidate>
        <section className="form-section">
          <h2>基本情報</h2>
          <div className="form-grid">
            {field(
              "productCode",
              "商品コード",
              <input value={form.productCode} onChange={(e) => set("productCode", e.target.value)} />,
              true,
            )}
            {field(
              "productName",
              "商品名",
              <input value={form.productName} onChange={(e) => set("productName", e.target.value)} />,
              true,
            )}
            {field(
              "category",
              "カテゴリ",
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">選択してください</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>,
              true,
            )}
            {field(
              "standardPrice",
              "標準価格",
              <input inputMode="numeric" min="0" type="number" value={form.standardPrice} onChange={(e) => set("standardPrice", e.target.value)} />,
              true,
            )}
            {field(
              "ticketButtonNumber",
              "券売機ボタン番号",
              <input value={form.ticketButtonNumber} onChange={(e) => set("ticketButtonNumber", e.target.value)} />,
            )}
            {field(
              "ticketDisplayPosition",
              "券売機表示位置",
              <input value={form.ticketDisplayPosition} onChange={(e) => set("ticketDisplayPosition", e.target.value)} />,
            )}
            {field(
              "salesStartDate",
              "販売開始日",
              <input type="date" value={form.salesStartDate} onChange={(e) => set("salesStartDate", e.target.value)} />,
              true,
            )}
            {field(
              "salesEndDate",
              "販売終了日",
              <input type="date" value={form.salesEndDate} onChange={(e) => set("salesEndDate", e.target.value)} />,
            )}
            {field(
              "futureCost",
              "原価（将来利用・任意）",
              <input inputMode="numeric" min="0" type="number" value={form.futureCost} onChange={(e) => set("futureCost", e.target.value)} />,
            )}
            <label className="field">
              <span>有効状態</span>
              <select
                value={form.isActive ? "active" : "inactive"}
                onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.value === "active" }))}
              >
                <option value="active">有効</option>
                <option value="inactive">無効</option>
              </select>
            </label>
          </div>
        </section>

        {priceChanged && (
          <section className="form-section price-change">
            <h2>価格変更</h2>
            <p className="muted">旧価格は上書きせず、価格履歴へ残します。</p>
            <div className="form-grid">
              {field(
                "priceValidFrom",
                "新価格の適用日",
                <input type="date" value={form.priceValidFrom} onChange={(e) => set("priceValidFrom", e.target.value)} />,
                true,
              )}
              {field(
                "priceChangeReason",
                "価格変更理由",
                <input value={form.priceChangeReason} onChange={(e) => set("priceChangeReason", e.target.value)} />,
                true,
              )}
            </div>
          </section>
        )}

        <div className="form-actions">
          <button className="button secondary" onClick={() => router.push("/products")} type="button">
            キャンセル
          </button>
          <button className="button" disabled={pending} type="submit">
            {pending ? "保存中…" : "保存内容を確認"}
          </button>
        </div>
      </form>

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog" aria-labelledby="confirm-title">
            <p className="eyebrow">Final check</p>
            <h2 id="confirm-title">この内容で保存しますか？</h2>
            <dl className="confirm-list">
              <div><dt>商品コード</dt><dd>{form.productCode}</dd></div>
              <div><dt>商品名</dt><dd>{form.productName}</dd></div>
              <div><dt>カテゴリ</dt><dd>{form.category}</dd></div>
              <div><dt>標準価格</dt><dd>¥{Number(form.standardPrice).toLocaleString("ja-JP")}</dd></div>
            </dl>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setConfirming(false)} type="button">戻って修正</button>
              <button className="button" disabled={pending} onClick={save} type="button">{pending ? "保存中…" : "保存する"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
