import { describe, expect, it } from "vitest";
import { isConfirmedSaleEligible } from "../product-matching/rules";
import { recognizeLocally } from "./local-runtime";

const GLYPHS: Record<string, string[]> = {
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["11110", "00001", "00001", "11110", "10000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function createDummyBmp(text: string) {
  const scale = 12;
  const margin = 24;
  const width = margin * 2 + text.length * 6 * scale;
  const height = margin * 2 + 7 * scale;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowSize * height, 255);

  for (const [characterIndex, character] of [...text].entries()) {
    const glyph = GLYPHS[character];
    for (const [row, line] of glyph.entries()) {
      for (const [column, bit] of [...line].entries()) {
        if (bit !== "1") continue;
        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            const pixelX = margin + (characterIndex * 6 + column) * scale + x;
            const pixelY = margin + row * scale + y;
            const offset = (height - 1 - pixelY) * rowSize + pixelX * 3;
            pixels.fill(0, offset, offset + 3);
          }
        }
      }
    }
  }

  const header = Buffer.alloc(54);
  header.write("BM");
  header.writeUInt32LE(header.length + pixels.length, 2);
  header.writeUInt32LE(header.length, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  return Buffer.concat([header, pixels]);
}

describe("ローカルOCR fixture画像", () => {
  it("通信なしの日本語モデルで原文と信頼度を生成し、確認前は集計しない", async () => {
    const analysis = await recognizeLocally(createDummyBmp("TEST 123"), "generated-dummy.bmp");

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
