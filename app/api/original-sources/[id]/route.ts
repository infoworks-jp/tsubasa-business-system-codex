import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { SOURCE_FILE_BUCKET, type SourceFileDbRow } from "@/lib/original-sources/types";
import { buildArchiveUpdate, SourceFileValidationError } from "@/lib/original-sources/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: error.message }, { status: 401 });
  }
  if (error instanceof SourceFileValidationError) {
    return NextResponse.json({ code: "INVALID_ARCHIVE", message: error.message }, { status: 400 });
  }
  if (error instanceof SupabaseNotConfiguredError) {
    return NextResponse.json(
      { code: "SUPABASE_NOT_CONFIGURED", message: "Supabase接続情報が未設定です" },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { message: error instanceof Error ? error.message : "原本ファイルの処理に失敗しました" },
    { status: 500 },
  );
}

async function findActiveRecord(
  client: ReturnType<typeof getAuthenticatedSupabaseClient>,
  id: string,
) {
  const { data, error } = await client
    .from("source_files")
    .select("id, original_filename, mime_type, size_bytes, sha256, storage_path, stored_at, archived_at, archive_reason, ocr_import_id")
    .eq("id", id)
    .is("archived_at", null)
    .single();
  if (error || !data) throw new SourceFileValidationError("対象の原本記録が見つかりません");
  return data as SourceFileDbRow;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedApiUser(request);
    const { id } = await context.params;
    const client = getAuthenticatedSupabaseClient(request);
    const record = await findActiveRecord(client, id);
    const { data, error } = await client.storage
      .from(SOURCE_FILE_BUCKET)
      .download(record.storage_path);
    if (error || !data) throw new Error(error?.message || "原本ファイルを取得できません");
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": record.mime_type,
        "Content-Length": String(record.size_bytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.original_filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedApiUser(request);
    const { id } = await context.params;
    const archiveUpdate = buildArchiveUpdate((await request.json()).reason);
    const client = getAuthenticatedSupabaseClient(request);
    await findActiveRecord(client, id);
    const { error } = await client
      .from("source_files")
      .update(archiveUpdate)
      .eq("id", id)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: "原本記録をアーカイブしました" });
  } catch (error) {
    return errorResponse(error);
  }
}
