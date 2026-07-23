export type OcrFieldKey =
  | "productName"
  | "quantity"
  | "amount"
  | "timeSlot"
  | "dailyTotal";

export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrField = {
  key: OcrFieldKey;
  label: string;
  value: string;
  confidence: number;
  box?: OcrBox;
};

export type OcrAnalysis = {
  engineId: string;
  engineName: string;
  imageName: string;
  createdAt: string;
  summary: string;
  fields: OcrField[];
};

export interface OcrEngine {
  id: string;
  label: string;
  description: string;
  analyze(file: File): Promise<OcrAnalysis>;
}
