import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedApiUser(request);
    const { id } = await context.params;
    const prices = await getProductRepository().prices(id);
    return NextResponse.json({ prices });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json(
        { code: "AUTH_REQUIRED", message: error.message },
        { status: 401 },
      );
    }
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json(
        { code: "SUPABASE_NOT_CONFIGURED", message: error.message },
        { status: 503 },
      );
    }
    console.error("Product price API error", error);
    return NextResponse.json(
      { message: "価格履歴の取得に失敗しました" },
      { status: 500 },
    );
  }
}
