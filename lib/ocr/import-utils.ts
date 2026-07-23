import type { OcrImportDraftRow, OcrImportSavedRow } from "./import-types";
import type { OcrImportQueueStatus, OcrImportRowStatus } from "./import-types";

export type OcrImportDbRow = {
  id: string;
  product_name: string;
  quantity: number;
  amount: number;
  time_slot: string;
  product_id: string | null;
  status: string;
  review_reason: string | null;
};

export type ParsedDraftRow = OcrImportDraftRow;

export type ParsedValidatedRow = {
  productName: string;
  quantity: number;
  amount: number;
  timeSlot: string;
};

export type ParseRowsOptions = {
  mode: "draft" | "validated";
};

export function toQueueStatusLabel(status: OcrImportQueueStatus) {
  if (status === "new") return "新規";
  if (status === "confirmed") return "確認済";
  if (status === "needs-review") return "要確認";
  return "エラー";
}

export function toQueueStatusClass(status: OcrImportQueueStatus) {
  if (status === "confirmed") return "success";
  if (status === "error") return "danger";
  return "warning";
}

export function toQueueStatusOrder(status: OcrImportQueueStatus) {
  if (status === "needs-review") return 0;
  if (status === "new") return 1;
  if (status === "error") return 2;
  return 3;
}

export function isProcessedRowStatus(status: OcrImportRowStatus | string) {
  return status === "processed";
}

export function toNumber(text: string) {
  const cleaned = text.replace(/[,，円\s]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseBusinessDate(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

export function parseRows(raw: unknown, options: { mode: "draft" }): ParsedDraftRow[];
export function parseRows(raw: unknown, options: { mode: "validated" }): ParsedValidatedRow[];
export function parseRows(raw: unknown, options: ParseRowsOptions): ParsedDraftRow[] | ParsedValidatedRow[] {
  if (!Array.isArray(raw)) return [];

  const mapped = raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const productName = String(item.productName ?? "").trim();
      const quantity = String(item.quantity ?? "").trim();
      const amount = String(item.amount ?? "").trim();
      const timeSlot = String(item.timeSlot ?? "").trim();

      if (options.mode === "draft") {
        if ([productName, quantity, amount].every((value) => value.length === 0)) {
          return null;
        }

        return {
          productName,
          quantity,
          amount,
          timeSlot,
        } satisfies ParsedDraftRow;
      }

      if ([productName, quantity, amount, timeSlot].every((value) => value.length === 0)) {
        return null;
      }

      return {
        productName: productName || "要確認",
        quantity: toNumber(quantity),
        amount: toNumber(amount),
        timeSlot: timeSlot || "要確認",
      } satisfies ParsedValidatedRow;
    })
    .filter((row): row is ParsedDraftRow | ParsedValidatedRow => row !== null);

  return options.mode === "draft"
    ? (mapped as ParsedDraftRow[])
    : (mapped as ParsedValidatedRow[]);
}

export function toSavedRow(row: OcrImportDbRow): OcrImportSavedRow {
  return {
    id: String(row.id),
    productName: String(row.product_name),
    quantity: Number(row.quantity ?? 0),
    amount: Number(row.amount ?? 0),
    timeSlot: String(row.time_slot ?? ""),
    productId: row.product_id ? String(row.product_id) : null,
    status: isProcessedRowStatus(row.status) ? "processed" : "needs-review",
    reviewReason: row.review_reason ? String(row.review_reason) : null,
  };
}