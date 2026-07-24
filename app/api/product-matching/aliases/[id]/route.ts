import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedApiUser(request);
    const reason = String((await request.json()).reason ?? "").trim();
    if (!reason) return NextResponse.json({ message: "アーカイブ理由が必要です" }, { status: 400 });
    const { id } = await context.params;
    const client = getAuthenticatedSupabaseClient(request);
    const { error } = await client
      .from("product_name_aliases")
      .update({ archived_at: new Date().toISOString(), archived_reason: reason })
      .eq("id", id)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: "表記ゆれ対応をアーカイブしました" });
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "表記ゆれ対応を更新できません" },
      { status },
    );
  }
}
