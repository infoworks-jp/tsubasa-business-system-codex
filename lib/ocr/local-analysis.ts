import type { OcrAnalysis, OcrField, OcrFieldKey } from "./types";

export const LOCAL_OCR_CONFIDENCE_THRESHOLD = 70;

const FIELD_LABELS: Record<OcrFieldKey, string> = {
  productName: "商品名",
  quantity: "数量",
  amount: "金額",
  timeSlot: "時間帯",
  dailyTotal: "日計",
};

function exactField(rawText: string, pattern: RegExp) {
  return rawText.match(pattern)?.[1]?.trim() ?? "";
}

export function buildLocalOcrAnalysis(
  rawText: string,
  imageName: string,
  confidence: number,
): OcrAnalysis {
  const normalizedConfidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(100, confidence))
    : 0;
  const extracted: Record<OcrFieldKey, string> = {
    productName: exactField(rawText, /商品名[ \t]*[:：][ \t]*(.+)/),
    quantity: exactField(rawText, /数量[ \t]*[:：][ \t]*([0-9]+)/),
    amount: exactField(rawText, /金額[ \t]*[:：][ \t]*([0-9,]+)/),
    timeSlot: exactField(rawText, /時間(?:帯)?[ \t]*[:：][ \t]*([0-9]{1,2}:[0-9]{2})/),
    dailyTotal: exactField(rawText, /日計[ \t]*[:：][ \t]*([0-9,]+)/),
  };
  const lowConfidence = normalizedConfidence < LOCAL_OCR_CONFIDENCE_THRESHOLD;
  const fields: OcrField[] = (Object.keys(FIELD_LABELS) as OcrFieldKey[]).map((key) => ({
    key,
    label: FIELD_LABELS[key],
    value: !lowConfidence && extracted[key] ? extracted[key] : "要確認",
    confidence: extracted[key] ? normalizedConfidence : 0,
  }));

  return {
    engineId: "tesseract-local-jpn",
    engineName: "Tesseract（ローカル日本語）",
    imageName,
    createdAt: new Date().toISOString(),
    summary: lowConfidence
      ? `信頼度が${LOCAL_OCR_CONFIDENCE_THRESHOLD}%未満のため要確認です。`
      : "ローカルOCRの原文から、明示された項目だけを抽出しました。",
    rawText,
    confidence: normalizedConfidence,
    fields,
  };
}
