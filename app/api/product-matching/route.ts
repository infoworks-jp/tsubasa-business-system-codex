import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedApiUser(request);
    const client = getAuthenticatedSupabaseClient(request);
    const [productsResult, aliasesResult, rowsResult] = await Promise.all([
      client.from("products").select("id, product_name").eq("is_active", true).order("product_name"),
      client
        .from("product_name_aliases")
        .select("id, source_name, normalized_name, product_id, confirmed_at, archived_at")
        .is("archived_at", null)
        .order("confirmed_at", { ascending: false }),
      client
        .from("ticket_ocr_import_rows")
        .select("id, import_id, original_product_name, product_name, product_id, quantity, amount, status, review_reason, recorded_at, effective_business_date, sales_confirmed_at, archived_at, ticket_ocr_imports!inner(queue_status, archived_at, business_date)")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const error = productsResult.error || aliasesResult.error || rowsResult.error;
    if (error) throw new Error(error.message);
    return NextResponse.json({
      products: productsResult.data ?? [],
      aliases: aliasesResult.data ?? [],
      rows: rowsResult.data ?? [],
    });
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "商品照合情報を取得できません" },
      { status },
    );
  }
}
