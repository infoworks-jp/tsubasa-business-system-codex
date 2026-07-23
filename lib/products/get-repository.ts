import "server-only";
import type { ProductRepository } from "./repository";
import { PreviewProductRepository } from "./preview-repository";
import { SupabaseProductRepository } from "./supabase-repository";

declare global {
  var __tsubasaPreviewProducts: PreviewProductRepository | undefined;
}

export function getProductRepository(): ProductRepository {
  if (process.env.PRODUCTS_PREVIEW_MODE === "true") {
    globalThis.__tsubasaPreviewProducts ??= new PreviewProductRepository();
    return globalThis.__tsubasaPreviewProducts;
  }
  return new SupabaseProductRepository();
}
