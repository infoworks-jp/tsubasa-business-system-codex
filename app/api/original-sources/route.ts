import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { SOURCE_FILE_BUCKET, type SourceFileDbRow, toSourceFileRecord } from "@/lib/original-sources/types";
import { calculateSha256, SourceFileValidationError, validateSourceFile } from "@/lib/original-sources/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: error.message }, { status: 401 });
  }
  if (error instanceof SourceFileValidationError) {
    return NextResponse.json({ code: "INVALID_SOURCE_FILE", message: error.message }, { status: 400 });
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

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedApiUser(request);
    const client = getAuthenticatedSupabaseClient(request);
    const { data, error } = await client
      .from("source_files")
      .select("id, original_filename, mime_type, size_bytes, sha256, storage_path, stored_at, archived_at, archive_reason, ocr_import_id")
      .is("archived_at", null)
      .order("stored_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      records: ((data ?? []) as SourceFileDbRow[]).map(toSourceFileRecord),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedApiUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new SourceFileValidationError("登録する原本ファイルを選択してください");
    }
    validateSourceFile(file);

    const ocrImportIdValue = String(formData.get("ocrImportId") ?? "").trim();
    const sha256 = await calculateSha256(file);
    const storagePath = `${user.id}/${randomUUID()}`;
    const client = getAuthenticatedSupabaseClient(request);
    const { error: uploadError } = await client.storage
      .from(SOURCE_FILE_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error: insertError } = await client
      .from("source_files")
      .insert({
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sha256,
        storage_path: storagePath,
        ocr_import_id: ocrImportIdValue || null,
        created_by: user.id,
      })
      .select("id, original_filename, mime_type, size_bytes, sha256, storage_path, stored_at, archived_at, archive_reason, ocr_import_id")
      .single();
    if (insertError || !data) {
      throw new Error(insertError?.message || "原本記録の保存に失敗しました");
    }
    return NextResponse.json(
      { record: toSourceFileRecord(data as SourceFileDbRow) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
