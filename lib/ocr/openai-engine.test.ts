import { describe, expect, it } from "vitest";
import { normalizeOpenAiResponse, parseOcrResponseText } from "./openai-engine";

describe("normalizeOpenAiResponse", () => {
  it("returns 要確認 for missing values and preserves box metadata", () => {
    const result = normalizeOpenAiResponse(
      {
        summary: "件数を読取りました",
        fields: [
          {
            key: "productName",
            label: "商品名",
            value: "味一番つばさ ラーメン",
            confidence: 0.95,
            box: { x: 12, y: 18, width: 45, height: 7 },
          },
          {
            key: "quantity",
            label: "数量",
            value: "",
            confidence: 0,
            box: { x: 60, y: 24, width: 8, height: 7 },
          },
        ],
      },
      "journal.jpg",
    );

    expect(result.summary).toBe("件数を読取りました");
    expect(result.fields.find((field) => field.key === "productName")?.value).toBe("味一番つばさ ラーメン");
    expect(result.fields.find((field) => field.key === "quantity")?.value).toBe("要確認");
    expect(result.fields.find((field) => field.key === "quantity")?.confidence).toBe(0);
  });
});

describe("parseOcrResponseText", () => {
  it("parses plain JSON", () => {
    const parsed = parseOcrResponseText('{"summary":"ok","fields":[]}');
    expect(parsed.summary).toBe("ok");
  });

  it("parses JSON wrapped in markdown code fences", () => {
    const parsed = parseOcrResponseText("```json\n{\"summary\":\"wrapped\",\"fields\":[]}\n```");
    expect(parsed.summary).toBe("wrapped");
  });
});
