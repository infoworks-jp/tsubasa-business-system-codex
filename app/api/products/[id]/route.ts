import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getProductRepository } from "@/lib/products/get-repository";
import {
  ProductCodeConflictError,
  ProductNotFoundError,
  ProductPricePeriodError,
  SupabaseNotConfiguredError,
} from "@/lib/products/repository";
import { productInputSchema, validationErrors } from "@/lib/products/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    await requireAuthenticatedApiUser(_);
    const { id } = await context.params;
    const product = await getProductRepository().find(id);
    if (!product) throw new ProductNotFoundError();
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
    const { id } = await context.params;
    const product = await getProductRepository().update(id, parsed.data);
    return NextResponse.json({ product, message: "商品を更新しました" });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAuthenticatedApiUser(request);
    const body = (await request.json()) as {
      isActive?: unknown;
      deactivationReason?: unknown;
    };
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { message: "有効状態が正しくありません" },
        { status: 400 },
      );
    }
    const reason =
      typeof body.deactivationReason === "string"
        ? body.deactivationReason.trim()
        : null;
    const { id } = await context.params;
    const product = await getProductRepository().setActive(id, body.isActive, reason);
    return NextResponse.json({
      product,
      message: body.isActive ? "商品を再有効化しました" : "商品を無効化しました",
    });
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
  if (error instanceof ProductNotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
  if (error instanceof ProductCodeConflictError) {
    return NextResponse.json({ message: error.message, fieldErrors: { productCode: [error.message] } }, { status: 409 });
  }
  if (error instanceof ProductPricePeriodError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  console.error("Product API error", error);
  return NextResponse.json(
    { message: "商品の処理に失敗しました。時間をおいて再度お試しください。" },
    { status: 500 },
  );
}
