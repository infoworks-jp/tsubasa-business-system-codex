import { describe, expect, it } from "vitest";
import { resolveWorkflowStatus } from "./workflow";

const fixture = {
  sourceArchivedAt: null,
  importId: null,
  importStatus: null,
  rowCount: 0,
  invalidDetailCount: 0,
  unmatchedProductCount: 0,
  unconfirmedSalesCount: 0,
};

describe("P5実運用フローfixture", () => {
  it("原本登録直後は取込待ちになる", () => {
    expect(resolveWorkflowStatus(fixture)).toBe("import-waiting");
  });

  it("取込作成後は手入力待ちになる", () => {
    expect(resolveWorkflowStatus({ ...fixture, importId: "import-1", importStatus: "new" }))
      .toBe("manual-entry");
  });

  it("入力不備は明細要確認で停止する", () => {
    expect(resolveWorkflowStatus({
      ...fixture, importId: "import-1", importStatus: "needs-review",
      rowCount: 1, invalidDetailCount: 1,
    })).toBe("detail-review");
  });

  it("明細確認後の商品未確定は商品照合待ちになる", () => {
    expect(resolveWorkflowStatus({
      ...fixture, importId: "import-1", importStatus: "needs-review",
      rowCount: 1, unmatchedProductCount: 1,
    })).toBe("product-matching");
  });

  it("商品確定後も売上未確認なら集計しない", () => {
    expect(resolveWorkflowStatus({
      ...fixture, importId: "import-1", importStatus: "confirmed",
      rowCount: 1, unconfirmedSalesCount: 1,
    })).toBe("sales-confirmation");
  });

  it("商品と売上の確認後だけ集計反映済みになる", () => {
    expect(resolveWorkflowStatus({
      ...fixture, importId: "import-1", importStatus: "confirmed", rowCount: 1,
    })).toBe("completed");
  });

  it("アーカイブ済みは常に集計対象外になる", () => {
    expect(resolveWorkflowStatus({
      ...fixture, sourceArchivedAt: "2026-07-25T00:00:00.000Z",
      importId: "import-1", importStatus: "confirmed", rowCount: 1,
    })).toBe("archived");
  });
});
