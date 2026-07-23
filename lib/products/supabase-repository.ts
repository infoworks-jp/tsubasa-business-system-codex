import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ProductCodeConflictError,
  ProductNotFoundError,
  ProductPricePeriodError,
  SupabaseNotConfiguredError,
  type ProductRepository,
} from "./repository";
import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductPrice,
} from "./types";

type ProductRow = {
  id: string;
  product_code: string;
  product_name: string;
  category: Product["category"];
  ticket_button_number: string | null;
  ticket_display_position: string | null;
  sales_start_date: string;
  sales_end_date: string | null;
  standard_price: number;
  future_cost: number | null;
  is_active: boolean;
  deactivation_reason: string | null;
  created_at: string;
  updated_at: string;
};

type PriceRow = {
  id: string;
  product_id: string;
  price: number;
  valid_from: string;
  valid_to: string | null;
  change_reason: string;
  created_at: string;
};

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  productCode: row.product_code,
  productName: row.product_name,
  category: row.category,
  ticketButtonNumber: row.ticket_button_number,
  ticketDisplayPosition: row.ticket_display_position,
  salesStartDate: row.sales_start_date,
  salesEndDate: row.sales_end_date,
  standardPrice: row.standard_price,
  futureCost: row.future_cost,
  isActive: row.is_active,
  deactivationReason: row.deactivation_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPrice = (row: PriceRow): ProductPrice => ({
  id: row.id,
  productId: row.product_id,
  price: row.price,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  changeReason: row.change_reason,
  createdAt: row.created_at,
});

const productPayload = (input: ProductInput) => ({
  product_code: input.productCode,
  product_name: input.productName,
  category: input.category,
  ticket_button_number: input.ticketButtonNumber,
  ticket_display_position: input.ticketDisplayPosition,
  sales_start_date: input.salesStartDate,
  sales_end_date: input.salesEndDate,
  standard_price: input.standardPrice,
  future_cost: input.futureCost,
  is_active: input.isActive ?? true,
});

function toRepositoryError(error: unknown): Error {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message ?? "");
    if (
      message.includes("Could not find the table") ||
      message.includes("does not exist") ||
      message.includes("schema cache")
    ) {
      return new SupabaseNotConfiguredError();
    }
  }
  return error instanceof Error ? error : new Error("Unexpected error");
}

export class SupabaseProductRepository implements ProductRepository {
  async list(filters: ProductFilters = {}) {
    const client = getSupabaseServerClient();
    let query = client.from("products").select("*").order("product_code");
    if (filters.search) {
      const escaped = filters.search.replace(/[%_,]/g, "");
      query = query.or(
        `product_code.ilike.%${escaped}%,product_name.ilike.%${escaped}%`,
      );
    }
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.active === "active") query = query.eq("is_active", true);
    if (filters.active === "inactive") query = query.eq("is_active", false);
    const sortBy = filters.sortBy ?? "code";
    const sortDirection = filters.sortDirection ?? "asc";
    query = query.order(sortBy === "name" ? "product_name" : "product_code", {
      ascending: sortDirection === "asc",
    });
    const { data, error } = await query;
    if (error) throw toRepositoryError(error);
    return (data as ProductRow[]).map(toProduct);
  }

  async find(id: string) {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw toRepositoryError(error);
    return data ? toProduct(data as ProductRow) : null;
  }

  async create(input: ProductInput) {
    const client = getSupabaseServerClient();
    const { data, error } = await client.rpc("create_product_with_price", {
      product_data: productPayload(input),
      initial_reason: input.priceChangeReason || "初回登録",
    });
    if (error?.code === "23505") throw new ProductCodeConflictError();
    if (error) throw toRepositoryError(error);
    return toProduct(data as ProductRow);
  }

  async update(id: string, input: ProductInput) {
    const client = getSupabaseServerClient();
    const { data, error } = await client.rpc("update_product_with_price", {
      target_product_id: id,
      product_data: productPayload(input),
      price_reason: input.priceChangeReason || "商品編集",
      price_valid_from: input.priceValidFrom || null,
    });
    if (error?.code === "23505") throw new ProductCodeConflictError();
    if (error?.code === "P0002") throw new ProductNotFoundError();
    if (error?.code === "22023") throw new ProductPricePeriodError();
    if (error) throw toRepositoryError(error);
    return toProduct(data as ProductRow);
  }

  async setActive(id: string, active: boolean, reason?: string | null) {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("products")
      .update({
        is_active: active,
        deactivation_reason: active ? null : reason ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error?.code === "PGRST116") throw new ProductNotFoundError();
    if (error) throw toRepositoryError(error);
    return toProduct(data as ProductRow);
  }

  async prices(productId: string) {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("product_prices")
      .select("*")
      .eq("product_id", productId)
      .order("valid_from", { ascending: false });
    if (error) throw toRepositoryError(error);
    return (data as PriceRow[]).map(toPrice);
  }
}
