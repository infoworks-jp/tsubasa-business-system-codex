import { describe, expect, it } from "vitest";
import {
  isConfirmedSaleEligible,
  normalizeProductAlias,
  resolveJstBusinessDate,
  resolveProductFromAliases,
} from "./rules";

describe("商品照合", () => {
  it("人が登録した表記ゆれとだけ一致する", () => {
    const aliases = [{ normalizedName: normalizeProductAlias("味噌 ラーメン"), productId: "product-1" }];
    expect(resolveProductFromAliases("味噌　ラーメン", aliases)).toEqual({
      status: "processed", productId: "product-1", reviewReason: null,
    });
  });

  it("未確定商品を推測せず要確認にする", () => {
    expect(resolveProductFromAliases("不明な商品原文", [])).toMatchObject({
      status: "needs-review", productId: null,
    });
  });
});

describe("売上確定集計", () => {
  const confirmed = {
    importStatus: "confirmed", importArchivedAt: null, rowStatus: "processed",
    rowArchivedAt: null, productId: "product-1",
    salesConfirmedAt: "2026-07-25T00:00:00.000Z",
  };

  it("商品確定かつ売上確認済みだけを含める", () => {
    expect(isConfirmedSaleEligible(confirmed)).toBe(true);
  });

  it.each([
    ["要確認", { rowStatus: "needs-review" }],
    ["未確認", { salesConfirmedAt: null }],
    ["アーカイブ済み", { importArchivedAt: "2026-07-25T00:00:00.000Z" }],
    ["商品未確定", { productId: null }],
  ])("%sを集計から除外する", (_label, override) => {
    expect(isConfirmedSaleEligible({ ...confirmed, ...override })).toBe(false);
  });
});

describe("日本時間の営業日", () => {
  it("月曜0時から3時台を前日の日曜にまとめる", () => {
    expect(resolveJstBusinessDate("2026-07-26T15:00:00.000Z")).toBe("2026-07-26");
    expect(resolveJstBusinessDate("2026-07-26T18:59:59.000Z")).toBe("2026-07-26");
  });

  it("月曜4時以降の実データを月曜のまま保持する", () => {
    expect(resolveJstBusinessDate("2026-07-26T19:00:00.000Z")).toBe("2026-07-27");
    expect(resolveJstBusinessDate("2026-07-27T03:00:00.000Z")).toBe("2026-07-27");
  });
});
