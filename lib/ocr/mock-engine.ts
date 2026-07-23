import type { OcrAnalysis, OcrEngine } from "./types";

export class MockOcrEngine implements OcrEngine {
  id = "mock";
  label = "検証用モックOCR";
  description = "画面とUI検証用のモック実装です。後から実OCRへ置き換えられます。";

  async analyze(file: File): Promise<OcrAnalysis> {
    const fileName = file.name || "uploaded-image";
    return {
      engineId: this.id,
      engineName: this.label,
      imageName: fileName,
      createdAt: new Date().toISOString(),
      summary: `${fileName} を読み取りました。実OCR実装に差し替える前の検証用サンプルです。`,
      fields: [
        {
          key: "productName",
          label: "商品名",
          value: "味一番つばさ ラーメン",
          confidence: 92,
          box: { x: 11, y: 18, width: 48, height: 8 },
        },
        {
          key: "quantity",
          label: "数量",
          value: "2",
          confidence: 88,
          box: { x: 56, y: 26, width: 8, height: 8 },
        },
        {
          key: "amount",
          label: "金額",
          value: "1,200",
          confidence: 91,
          box: { x: 64, y: 26, width: 18, height: 8 },
        },
        {
          key: "timeSlot",
          label: "時間帯",
          value: "要確認",
          confidence: 0,
          box: { x: 22, y: 42, width: 18, height: 8 },
        },
        {
          key: "dailyTotal",
          label: "日計",
          value: "要確認",
          confidence: 0,
          box: { x: 64, y: 42, width: 20, height: 8 },
        },
      ],
    };
  }
}
