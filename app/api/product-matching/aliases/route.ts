import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { normalizeProductAlias } from "@/lib/product-matching/rules";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedApiUser(request);
    const body = await request.json();
    const sourceName = String(body.sourceName ?? "").trim();
    const productId = String(body.productId ?? "").trim();
    if (!sourceName || !productId) {
      return NextResponse.json({ message: "原文と確認済み商品を指定してください" }, { status: 400 });
    }
    const client = getAuthenticatedSupabaseClient(request);
    const { data, error } = await client
      .from("product_name_aliases")
      .insert({
        source_name: sourceName,
        normalized_name: normalizeProductAlias(sourceName),
        product_id: productId,
        confirmed_by: user.id,
      })
      .select("id, source_name, normalized_name, product_id, confirmed_at, archived_at")
      .single();
    if (error || !data) throw new Error(error?.message || "表記ゆれ対応を登録できません");
    return NextResponse.json({ alias: data }, { status: 201 });
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "表記ゆれ対応を登録できません" },
      { status },
    );
  }
}
