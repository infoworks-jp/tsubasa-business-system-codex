export type OcrImportDraftRow = {
  productName: string;
  quantity: string;
  amount: string;
  timeSlot: string;
};

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
  createdAt: string;
  rows: OcrImportSavedRow[];
  summary: {
    total: number;
    processed: number;
    needsReview: number;
  };
};
