import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { resolveJstBusinessDate } from "@/lib/product-matching/rules";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedApiUser(request);
    const body = await request.json();
    const productId = String(body.productId ?? "").trim() || null;
    const reason = String(body.reason ?? "").trim();
    const confirmSales = body.confirmSales === true;
    const recordedAt = String(body.recordedAt ?? "").trim() || null;
    if (!reason) return NextResponse.json({ message: "変更理由が必要です" }, { status: 400 });
    if (confirmSales && !productId) {
      return NextResponse.json({ message: "商品未確定の売上は確認済みにできません" }, { status: 400 });
    }
    if (recordedAt) resolveJstBusinessDate(recordedAt);

    const { id } = await context.params;
    const client = getAuthenticatedSupabaseClient(request);
    const { data: current, error: currentError } = await client
      .from("ticket_ocr_import_rows")
      .select("recorded_at")
      .eq("id", id)
      .is("archived_at", null)
      .single();
    if (currentError || !current) throw new Error("対象のOCR明細が見つかりません");
    if (current.recorded_at && recordedAt && current.recorded_at !== recordedAt) {
      return NextResponse.json({ message: "元の記録日時は変更できません" }, { status: 409 });
    }

    const update = {
      product_id: productId,
      status: productId ? "processed" : "needs-review",
      review_reason: productId ? null : "商品対応を要確認",
      sales_confirmed_at: confirmSales ? new Date().toISOString() : null,
      sales_confirmed_by: confirmSales ? user.id : null,
      recorded_at: current.recorded_at || recordedAt,
      effective_business_date: recordedAt ? resolveJstBusinessDate(recordedAt) : undefined,
      match_change_reason: reason,
    };
    const { error } = await client.from("ticket_ocr_import_rows").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    const { error: rebuildError } = await client.rpc("rebuild_ticket_product_sales_totals");
    if (rebuildError) throw new Error(rebuildError.message);
    return NextResponse.json({ message: confirmSales ? "商品と売上を確認済みにしました" : "商品照合を更新しました" });
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "商品照合を更新できません" },
      { status },
    );
  }
}
