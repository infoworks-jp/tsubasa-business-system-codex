import { describe, expect, it } from "vitest";
import { buildLocalOcrAnalysis } from "./local-analysis";

describe("buildLocalOcrAnalysis", () => {
  it("extracts known fields and falls back to 要確認 for missing values", () => {
    const analysis = buildLocalOcrAnalysis(
      "商品名: 味一番つばさ ラーメン\n数量: 2\n金額: 1,200\n時間: 12:30\n",
      "journal.jpg",
      82,
    );

    expect(analysis.fields.find((field) => field.key === "productName")?.value).toBe("味一番つばさ ラーメン");
    expect(analysis.fields.find((field) => field.key === "quantity")?.value).toBe("2");
    expect(analysis.fields.find((field) => field.key === "amount")?.value).toBe("1,200");
    expect(analysis.fields.find((field) => field.key === "dailyTotal")?.value).toBe("要確認");
    expect(analysis.fields.find((field) => field.key === "dailyTotal")?.confidence).toBe(0);
  });
});
