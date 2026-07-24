import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedApiUser(request);
    const businessDate = String((await request.json()).businessDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return NextResponse.json({ message: "営業日を確認してください" }, { status: 400 });
    }
    const { id } = await context.params;
    const client = getAuthenticatedSupabaseClient(request);
    const { data, error } = await client.rpc("create_manual_import_for_source", {
      target_source_id: id,
      target_business_date: businessDate,
    });
    if (error || !data) throw new Error(error?.message || "取込待ちを作成できません");
    return NextResponse.json({ importId: String(data), message: "手入力用の取込待ちを作成しました" });
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "取込待ちを作成できません" },
      { status },
    );
  }
}
