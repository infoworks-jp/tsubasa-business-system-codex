import { describe, expect, it } from "vitest";
import { PreviewProductRepository } from "./preview-repository";
import {
  ProductCodeConflictError,
  ProductPricePeriodError,
} from "./repository";
import type { ProductInput } from "./types";
import { productInputSchema } from "./validation";

const validInput: ProductInput = {
  productCode: "TEST-001",
  productName: "テスト商品",
  category: "ラーメン",
  ticketButtonNumber: "10",
  ticketDisplayPosition: "1段目",
  salesStartDate: "2026-07-01",
  salesEndDate: null,
  standardPrice: 1000,
  futureCost: null,
  priceChangeReason: "初回登録",
};

describe("商品マスター", () => {
  it("商品を新規登録できる", async () => {
    const repository = new PreviewProductRepository([], []);
    const created = await repository.create(validInput);
    expect(created.productCode).toBe("TEST-001");
    expect((await repository.list()).length).toBe(1);
  });

  it("同じ商品コードを登録できない", async () => {
    const repository = new PreviewProductRepository([], []);
    await repository.create(validInput);
    await expect(repository.create(validInput)).rejects.toBeInstanceOf(
      ProductCodeConflictError,
    );
  });

  it("商品名を編集でき、価格変更時に履歴を残す", async () => {
    const repository = new PreviewProductRepository([], []);
    const created = await repository.create(validInput);
    const updated = await repository.update(created.id, {
      ...validInput,
      productName: "編集後の商品名",
      standardPrice: 1100,
      priceValidFrom: "2026-07-15",
      priceChangeReason: "価格改定",
    });
    expect(updated.productName).toBe("編集後の商品名");
    const prices = await repository.prices(created.id);
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatchObject({
      price: 1100,
      validFrom: "2026-07-15",
      changeReason: "価格改定",
    });
    expect(prices[1].validTo).toBe("2026-07-14");
  });

  it("無効化と再有効化ができる", async () => {
    const repository = new PreviewProductRepository([], []);
    const created = await repository.create(validInput);
    const deactivated = await repository.setActive(created.id, false, "在庫切れ");
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.deactivationReason).toBe("在庫切れ");
    expect((await repository.setActive(created.id, true)).isActive).toBe(true);
  });

  it("検索・カテゴリ・有効状態で絞り込める", async () => {
    const repository = new PreviewProductRepository([], []);
    await repository.create(validInput);
    const drink = await repository.create({
      ...validInput,
      productCode: "DRINK-001",
      productName: "テストドリンク",
      category: "ドリンク",
    });
    await repository.setActive(drink.id, false);
    expect(await repository.list({ search: "TEST-001" })).toHaveLength(1);
    expect(await repository.list({ category: "ドリンク" })).toHaveLength(1);
    expect(await repository.list({ active: "inactive" })).toHaveLength(1);
  });

  it("商品名順に並び替えられる", async () => {
    const repository = new PreviewProductRepository([], []);
    await repository.create({ ...validInput, productCode: "Z-001", productName: "Zulu" });
    await repository.create({ ...validInput, productCode: "A-001", productName: "Alpha" });
    const sorted = await repository.list({ sortBy: "name", sortDirection: "asc" });
    expect(sorted.map((product) => product.productName)).toEqual(["Alpha", "Zulu"]);
  });

  it("不正な日付や負の価格を拒否する", () => {
    const invalid = productInputSchema.safeParse({
      ...validInput,
      standardPrice: -1,
      salesStartDate: "2026-07-10",
      salesEndDate: "2026-07-09",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const fields = invalid.error.flatten().fieldErrors;
      expect(fields.standardPrice).toBeDefined();
      expect(fields.salesEndDate).toBeDefined();
    }
  });

  it("任意項目のnullを受け入れ、価格履歴の期間重複を拒否する", async () => {
    expect(productInputSchema.safeParse(validInput).success).toBe(true);

    const repository = new PreviewProductRepository([], []);
    const created = await repository.create(validInput);
    await expect(
      repository.update(created.id, {
        ...validInput,
        standardPrice: 1100,
        priceValidFrom: "2026-07-01",
        priceChangeReason: "不正な適用日",
      }),
    ).rejects.toBeInstanceOf(ProductPricePeriodError);
  });
});
