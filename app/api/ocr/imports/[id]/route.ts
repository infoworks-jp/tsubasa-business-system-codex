import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return NextResponse.json(
    {
      message: "この操作は現在のフェーズでは無効です。",
      todo: "TODO: 第2段階で商品照合、第3段階で売上集計連携を実装予定",
      importId: String(params.id ?? ""),
    },
    { status: 501 },
  );
}
