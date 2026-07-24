export type WorkflowStatus =
  | "import-waiting"
  | "manual-entry"
  | "detail-review"
  | "product-matching"
  | "sales-confirmation"
  | "completed"
  | "archived";

export type WorkflowInput = {
  sourceArchivedAt: string | null;
  importId: string | null;
  importStatus: string | null;
  rowCount: number;
  invalidDetailCount: number;
  unmatchedProductCount: number;
  unconfirmedSalesCount: number;
};

export function resolveWorkflowStatus(input: WorkflowInput): WorkflowStatus {
  if (input.sourceArchivedAt) return "archived";
  if (!input.importId) return "import-waiting";
  if (input.rowCount === 0) return "manual-entry";
  if (input.invalidDetailCount > 0) return "detail-review";
  if (input.unmatchedProductCount > 0) return "product-matching";
  if (input.importStatus !== "confirmed" || input.unconfirmedSalesCount > 0) {
    return "sales-confirmation";
  }
  return "completed";
}

export function workflowStatusLabel(status: WorkflowStatus) {
  return {
    "import-waiting": "取込待ち",
    "manual-entry": "明細手入力待ち",
    "detail-review": "明細要確認",
    "product-matching": "商品照合待ち",
    "sales-confirmation": "売上確認待ち",
    completed: "集計反映済み",
    archived: "アーカイブ済み",
  }[status];
}
