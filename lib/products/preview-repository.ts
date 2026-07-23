import {
  ProductCodeConflictError,
  ProductNotFoundError,
  ProductPricePeriodError,
  type ProductRepository,
} from "./repository";
import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductPrice,
} from "./types";

const now = "2026-07-17T00:00:00.000Z";

const seedProducts: Product[] = [
  {
    id: "preview-product-1",
    productCode: "DEMO-001",
    productName: "画面確認用ラーメン",
    category: "ラーメン",
    ticketButtonNumber: "01",
    ticketDisplayPosition: "1段目・左",
    salesStartDate: "2026-07-01",
    salesEndDate: null,
    standardPrice: 1000,
    futureCost: null,
    isActive: true,
    deactivationReason: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preview-product-2",
    productCode: "DEMO-002",
    productName: "画面確認用ドリンク",
    category: "ドリンク",
    ticketButtonNumber: "20",
    ticketDisplayPosition: "3段目・右",
    salesStartDate: "2026-07-01",
    salesEndDate: null,
    standardPrice: 500,
    futureCost: null,
    isActive: false,
    deactivationReason: "画面確認用",
    createdAt: now,
    updatedAt: now,
  },
];

const seedPrices: ProductPrice[] = [
  {
    id: "preview-price-1",
    productId: "preview-product-1",
    price: 900,
    validFrom: "2026-07-01",
    validTo: "2026-07-09",
    changeReason: "画面確認用の旧価格",
    createdAt: now,
  },
  {
    id: "preview-price-2",
    productId: "preview-product-1",
    price: 1000,
    validFrom: "2026-07-10",
    validTo: null,
    changeReason: "画面確認用の価格変更",
    createdAt: now,
  },
];

export class PreviewProductRepository implements ProductRepository {
  private products: Product[];
  private productPrices: ProductPrice[];

  constructor(
    products: Product[] = structuredClone(seedProducts),
    prices: ProductPrice[] = structuredClone(seedPrices),
  ) {
    this.products = products;
    this.productPrices = prices;
  }

  async list(filters: ProductFilters = {}) {
    const search = filters.search?.toLowerCase() ?? "";
    const filtered = this.products.filter((product) => {
      const matchesSearch =
        !search ||
        product.productCode.toLowerCase().includes(search) ||
        product.productName.toLowerCase().includes(search);
      const matchesCategory =
        !filters.category || product.category === filters.category;
      const matchesActive =
        !filters.active ||
        filters.active === "all" ||
        (filters.active === "active" && product.isActive) ||
        (filters.active === "inactive" && !product.isActive);
      return matchesSearch && matchesCategory && matchesActive;
    });

    const sortBy = filters.sortBy ?? "code";
    const direction = filters.sortDirection ?? "asc";
    const multiplier = direction === "desc" ? -1 : 1;

    return filtered.sort((left, right) => {
      const leftValue = sortBy === "name" ? left.productName : left.productCode;
      const rightValue = sortBy === "name" ? right.productName : right.productCode;
      return leftValue.localeCompare(rightValue, "ja", { sensitivity: "base" }) * multiplier;
    });
  }

  async find(id: string) {
    return this.products.find((product) => product.id === id) ?? null;
  }

  async create(input: ProductInput) {
    if (this.products.some((product) => product.productCode === input.productCode)) {
      throw new ProductCodeConflictError();
    }
    const product: Product = {
      ...input,
      id: `preview-product-${this.products.length + 1}`,
      isActive: input.isActive ?? true,
      deactivationReason: input.isActive === false ? input.deactivationReason ?? null : null,
      createdAt: now,
      updatedAt: now,
    };
    this.products.push(product);
    this.productPrices.push({
      id: `preview-price-${this.productPrices.length + 1}`,
      productId: product.id,
      price: product.standardPrice,
      validFrom: product.salesStartDate,
      validTo: null,
      changeReason: input.priceChangeReason || "初回登録",
      createdAt: now,
    });
    return product;
  }

  async update(id: string, input: ProductInput) {
    const index = this.products.findIndex((product) => product.id === id);
    if (index < 0) throw new ProductNotFoundError();
    if (
      this.products.some(
        (product) =>
          product.id !== id && product.productCode === input.productCode,
      )
    ) {
      throw new ProductCodeConflictError();
    }
    const previous = this.products[index];
    const updated: Product = {
      ...previous,
      ...input,
      isActive: input.isActive ?? previous.isActive,
      deactivationReason:
        input.isActive === false
          ? input.deactivationReason ?? previous.deactivationReason
          : null,
      updatedAt: now,
    };
    if (previous.standardPrice !== input.standardPrice) {
      if (!input.priceValidFrom) {
        throw new ProductPricePeriodError();
      }
      const current = this.productPrices.find(
        (price) => price.productId === id && price.validTo === null,
      );
      if (current) {
        if (input.priceValidFrom <= current.validFrom) {
          throw new ProductPricePeriodError();
        }
        const previousDate = new Date(`${input.priceValidFrom}T00:00:00Z`);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);
        current.validTo = previousDate.toISOString().slice(0, 10);
      }
      this.productPrices.push({
        id: `preview-price-${this.productPrices.length + 1}`,
        productId: id,
        price: input.standardPrice,
        validFrom: input.priceValidFrom,
        validTo: null,
        changeReason: input.priceChangeReason || "価格変更",
        createdAt: now,
      });
    }
    this.products[index] = updated;
    return updated;
  }

  async setActive(id: string, active: boolean, reason?: string | null) {
    const product = await this.find(id);
    if (!product) throw new ProductNotFoundError();
    product.isActive = active;
    product.deactivationReason = active ? null : reason ?? product.deactivationReason;
    product.updatedAt = now;
    return product;
  }

  async prices(productId: string) {
    return this.productPrices
      .filter((price) => price.productId === productId)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  }
}
