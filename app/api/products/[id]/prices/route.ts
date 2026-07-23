import { NextRequest, NextResponse } from "next/server";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const prices = await getProductRepository().prices(id);
    return NextResponse.json({ prices });
  } catch (error) {
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
