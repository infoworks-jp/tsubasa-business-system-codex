import type { OcrAnalysis, OcrBox, OcrField, OcrFieldKey, OcrEngine } from "./types";
import { createWorker } from "tesseract.js";

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

export function buildTesseractAnalysisFromText(text: string, imageName: string, confidence: number): OcrAnalysis {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const productNameMatch = normalized.match(/商品名[:：]\s*(.+?)(?=(数量|金額|時間|日計|$))/i);
  const quantityMatch = normalized.match(/数量[:：]\s*(\d+)/i);
  const amountMatch = normalized.match(/金額[:：]\s*([\d,]+)/i);
  const timeMatch = normalized.match(/時間[:：]\s*([\d:]+(?:\d+)?)/i);
  const dailyTotalMatch = normalized.match(/日計[:：]\s*([\d,]+)/i);

  const fields: OcrField[] = [
    {
      key: "productName",
      label: "商品名",
      value: productNameMatch?.[1]?.trim() || "要確認",
      confidence: productNameMatch ? confidence : 0,
      box: undefined,
    },
    {
      key: "quantity",
      label: "数量",
      value: quantityMatch?.[1]?.trim() || "要確認",
      confidence: quantityMatch ? confidence : 0,
      box: undefined,
    },
    {
      key: "amount",
      label: "金額",
      value: amountMatch?.[1]?.trim() || "要確認",
      confidence: amountMatch ? confidence : 0,
      box: undefined,
    },
    {
      key: "timeSlot",
      label: "時間帯",
      value: timeMatch?.[1]?.trim() || "要確認",
      confidence: timeMatch ? confidence : 0,
      box: undefined,
    },
    {
      key: "dailyTotal",
      label: "日計",
      value: dailyTotalMatch?.[1]?.trim() || "要確認",
      confidence: dailyTotalMatch ? confidence : 0,
      box: undefined,
    },
  ];

  return {
    engineId: "tesseract",
    engineName: "Tesseract",
    imageName,
    createdAt: new Date().toISOString(),
    summary: lower.includes("商品名") || lower.includes("数量") ? "Tesseract でテキストを抽出しました。" : "Tesseract で読み取りました。",
    fields,
  };
}

export class OpenAiVisionEngine implements OcrEngine {
  id = "openai-vision";
  label = "OpenAI Vision";
  description = "OpenAI Vision API で券売機ジャーナル画像を読み取り、JSON で結果を返します。";

  async analyze(file: File): Promise<OcrAnalysis> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/ocr", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "OCR処理に失敗しました" }));
      throw new Error(payload.error || "OCR処理に失敗しました");
    }

    return (await response.json()) as OcrAnalysis;
  }
}

export class GeminiVisionEngine implements OcrEngine {
  id = "gemini-vision";
  label = "Google Gemini Vision";
  description = "Gemini Vision で同じ画像を読み取り、比較用に結果を返します。";

  async analyze(file: File): Promise<OcrAnalysis> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/ocr/gemini", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "OCR処理に失敗しました" }));
      throw new Error(payload.error || "OCR処理に失敗しました");
    }

    return (await response.json()) as OcrAnalysis;
  }
}

export class TesseractEngine implements OcrEngine {
  id = "tesseract";
  label = "Tesseract";
  description = "ローカルの Tesseract で画像を読み取り、比較用に結果を返します。";

  async analyze(file: File): Promise<OcrAnalysis> {
    const worker = await createWorker("jpn");
    try {
      const { data } = await worker.recognize(file);
      return buildTesseractAnalysisFromText(data.text, file.name || "uploaded-image", 82);
    } finally {
      await worker.terminate();
    }
  }
}
