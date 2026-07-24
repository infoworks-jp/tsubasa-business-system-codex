import { describe, expect, it } from "vitest";
import {
  calculateSha256,
  buildArchiveUpdate,
  SourceFileValidationError,
  validateArchiveReason,
  validateSourceFile,
} from "./validation";

describe("原本ファイル検証", () => {
  it("生成したダミー画像を受け付ける", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "dummy.png", { type: "image/png" });
    expect(() => validateSourceFile(file)).not.toThrow();
  });

  it("空ファイルを拒否する", () => {
    expect(() => validateSourceFile(new File([], "empty.png", { type: "image/png" })))
      .toThrow(SourceFileValidationError);
  });

  it("未対応形式を拒否する", () => {
    const file = new File(["dummy"], "dummy.txt", { type: "text/plain" });
    expect(() => validateSourceFile(file)).toThrow("対応していないファイル形式です");
  });

  it("SHA-256を改変せず計算する", async () => {
    await expect(calculateSha256(new Blob(["dummy-source-file"]))).resolves.toBe(
      "7ba717c313f3d8d7337d98a5145a4f346b6ee858dd6f673bc1dc5f54d3614d74",
    );
  });

  it("アーカイブ理由を必須にする", () => {
    expect(() => validateArchiveReason(" ")).toThrow("アーカイブ理由を入力してください");
    expect(validateArchiveReason("重複登録のため")).toBe("重複登録のため");
  });

  it("物理削除せずアーカイブ情報を作る", () => {
    expect(buildArchiveUpdate("ダミー確認完了", new Date("2026-07-25T00:00:00.000Z"))).toEqual({
      archived_at: "2026-07-25T00:00:00.000Z",
      archive_reason: "ダミー確認完了",
    });
  });
});
