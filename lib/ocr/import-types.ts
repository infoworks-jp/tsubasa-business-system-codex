export type OcrImportDraftRow = {
  productName: string;
  quantity: string;
  amount: string;
  timeSlot: string;
};

export type OcrExecutionState = "not-run" | "success" | "failed";

export type OcrImportQueueStatus = "new" | "confirmed" | "needs-review" | "error" | "archived";

export type OcrImportRowStatus = "processed" | "needs-review";

export type OcrImportSavedRow = {
  id: string;
  productName: string;
  quantity: number;
  amount: number;
  timeSlot: string;
  productId: string | null;
  status: OcrImportRowStatus;
  reviewReason: string | null;
};

export type OcrImportRecord = {
  id: string;
  imageName: string;
  engineId: string;
  ocrState: OcrExecutionState;
  queueStatus: OcrImportQueueStatus;
  businessDate: string;
  createdAt: string;
  archivedAt?: string | null;
  confirmedAt?: string | null;
  savedAt?: string | null;
  errorMessage?: string | null;
  rawText?: string | null;
  ocrConfidence?: number | null;
  rows: OcrImportSavedRow[];
  summary: {
    total: number;
    processed: number;
    needsReview: number;
  };
};
