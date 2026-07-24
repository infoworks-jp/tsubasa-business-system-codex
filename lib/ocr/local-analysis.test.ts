import { describe, expect, it } from "vitest";
import { buildLocalOcrAnalysis } from "./local-analysis";

const fixtureText = [
  "商品名：テストうどん",
  "数量：2",
  "金額：1,200",
  "時間：18:30",
].join("\n");

describe("無料ローカルOCR結果", () => {
  it("OCR原文と実測信頼度を変更せず保持する", () => {
    const result = buildLocalOcrAnalysis(fixtureText, "fixture.png", 91.25);
    expect(result.rawText).toBe(fixtureText);
    expect(result.confidence).toBe(91.25);
    expect(result.fields.find((field) => field.key === "productName")?.value)
      .toBe("テストうどん");
  });

  it("低信頼度の抽出値を確定せず要確認にする", () => {
    const result = buildLocalOcrAnalysis(fixtureText, "fixture.png", 69.99);
    expect(result.fields.every((field) => field.value === "要確認")).toBe(true);
    expect(result.rawText).toBe(fixtureText);
  });

  it("原文に明示されない項目を推測しない", () => {
    const result = buildLocalOcrAnalysis("テストうどん 2 1200", "fixture.png", 99);
    expect(result.fields.every((field) => field.value === "要確認")).toBe(true);
  });
});
