import type { OcrAnalysis, OcrBox, OcrField, OcrFieldKey } from "./types";

const OCR_FIELD_KEYS: OcrFieldKey[] = [
  "productName",
  "quantity",
  "amount",
  "timeSlot",
  "dailyTotal",
];

const DEFAULT_LABELS: Record<OcrFieldKey, string> = {
  productName: "商品名",
  quantity: "数量",
  amount: "金額",
  timeSlot: "時間",
  dailyTotal: "日計",
};

type OpenAiResponse = {
  summary?: string;
  fields?: Array<{
    key?: string;
    label?: string;
    value?: string;
    confidence?: number;
    box?: OcrBox;
  }>;
};

export function parseOcrResponseText(text: string): OpenAiResponse {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as OpenAiResponse;
      }
    } catch {
      continue;
    }
  }

  throw new Error("OCR応答のJSON解析に失敗しました");
}

export function normalizeOpenAiResponse(response: OpenAiResponse, imageName: string): OcrAnalysis {
  const fields: OcrField[] = OCR_FIELD_KEYS.map((key) => {
    const existing = response.fields?.find((field) => field.key === key);
    const value = existing?.value?.trim() ? existing.value.trim() : "要確認";
    const confidence = typeof existing?.confidence === "number" ? Math.round(existing.confidence * 100) : 0;
    return {
      key,
      label: existing?.label?.trim() || DEFAULT_LABELS[key],
      value,
      confidence,
      box: existing?.box,
    };
  });

  return {
    engineId: "openai-vision",
    engineName: "OpenAI Vision",
    imageName,
    createdAt: new Date().toISOString(),
    summary: response.summary?.trim() || "OpenAI Vision で読み取りました。",
    fields,
  };
}
