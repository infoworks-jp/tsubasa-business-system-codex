import type { OcrAnalysis, OcrEngine } from "./types";

export class LocalTesseractEngine implements OcrEngine {
  id = "tesseract-local-jpn";
  label = "Tesseract（無料・ローカル）";
  description = "同梱した日本語言語データだけを使い、サーバー内で画像を読み取ります。";

  async analyze(file: File): Promise<OcrAnalysis> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/ocr/local", { method: "POST", body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "ローカルOCRに失敗しました" }));
      throw new Error(payload.error || "ローカルOCRに失敗しました");
    }
    return (await response.json()) as OcrAnalysis;
  }
}
