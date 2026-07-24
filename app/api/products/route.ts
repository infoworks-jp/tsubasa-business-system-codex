import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getProductRepository } from "@/lib/products/get-repository";
import {
  ProductCodeConflictError,
  SupabaseNotConfiguredError,
} from "@/lib/products/repository";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/products/types";
import { productInputSchema, validationErrors } from "@/lib/products/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedApiUser(request);
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const rawCategory = request.nextUrl.searchParams.get("category") ?? "";
    const category = PRODUCT_CATEGORIES.includes(rawCategory as ProductCategory)
      ? (rawCategory as ProductCategory)
      : "";
    const rawActive = request.nextUrl.searchParams.get("active");
    const active =
      rawActive === "active" || rawActive === "inactive" ? rawActive : "all";
    const products = await getProductRepository().list({
      search,
      category,
      active,
    });
    return NextResponse.json({ products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedApiUser(request);
    const parsed = productInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "入力内容を確認してください",
          fieldErrors: validationErrors(parsed.error),
        },
        { status: 400 },
      );
    }
    const product = await getProductRepository().create(parsed.data);
    return NextResponse.json(
      { product, message: "商品を登録しました" },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

function apiError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: error.message }, { status: 401 });
  }
  if (error instanceof SupabaseNotConfiguredError) {
    return NextResponse.json(
      { code: "SUPABASE_NOT_CONFIGURED", message: error.message },
      { status: 503 },
    );
  }
  if (error instanceof ProductCodeConflictError) {
    return NextResponse.json({ message: error.message, fieldErrors: { productCode: [error.message] } }, { status: 409 });
  }
  console.error("Product API error", error);
  return NextResponse.json(
    { message: "商品の処理に失敗しました。時間をおいて再度お試しください。" },
    { status: 500 },
  );
}
