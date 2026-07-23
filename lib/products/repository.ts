import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductPrice,
} from "./types";

export class ProductCodeConflictError extends Error {
  constructor() {
    super("同じ商品コードが既に登録されています");
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("商品が見つかりません");
  }
}

export class ProductPricePeriodError extends Error {
  constructor() {
    super("価格適用日は現在の価格の適用開始日より後にしてください");
  }
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase接続情報が未設定です。.env.localに接続情報を設定してください。",
    );
  }
}

export interface ProductRepository {
  list(filters?: ProductFilters): Promise<Product[]>;
  find(id: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product>;
  setActive(id: string, active: boolean, reason?: string | null): Promise<Product>;
  prices(productId: string): Promise<ProductPrice[]>;
}
