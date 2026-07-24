import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isConfirmedSaleEligible } from "../product-matching/rules";
import { recognizeLocally } from "./local-runtime";

describe("ローカルOCR fixture画像", () => {
  it("通信なしの日本語モデルで原文と信頼度を生成し、確認前は集計しない", async () => {
    const fixturePath = path.join(process.cwd(), "docs", "screenshots", "login.png");
    const analysis = await recognizeLocally(await readFile(fixturePath), "login-fixture.png");

    expect(analysis.engineId).toBe("tesseract-local-jpn");
    expect(analysis.rawText?.trim().length).toBeGreaterThan(0);
    expect(analysis.confidence).toBeTypeOf("number");
    expect(isConfirmedSaleEligible({
      importStatus: "new",
      importArchivedAt: null,
      rowStatus: "needs-review",
      rowArchivedAt: null,
      productId: null,
      salesConfirmedAt: null,
    })).toBe(false);
  }, 30_000);
});
