import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { SOURCE_FILE_BUCKET, type SourceFileDbRow, toSourceFileRecord } from "@/lib/original-sources/types";
import { calculateSha256, SourceFileValidationError, validateSourceFile } from "@/lib/original-sources/validation";
import { resolveWorkflowStatus } from "@/lib/operations/workflow";

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
    const sourceRows = (data ?? []) as SourceFileDbRow[];
    const importIds = sourceRows.flatMap((row) => row.ocr_import_id ? [row.ocr_import_id] : []);
    const { data: imports, error: importsError } = importIds.length > 0
      ? await client
          .from("ticket_ocr_imports")
          .select("id, queue_status, archived_at, ticket_ocr_import_rows(status, product_id, sales_confirmed_at, archived_at, review_reason)")
          .in("id", importIds)
      : { data: [], error: null };
    if (importsError) throw new Error(importsError.message);
    const importMap = new Map((imports ?? []).map((row) => [String(row.id), row]));

    return NextResponse.json({
      records: sourceRows.map((row) => {
        const importRow = row.ocr_import_id ? importMap.get(row.ocr_import_id) : null;
        const detailRows = (importRow?.ticket_ocr_import_rows ?? []).filter(
          (detail: { archived_at: string | null }) => detail.archived_at === null,
        );
        return {
          ...toSourceFileRecord(row),
          workflowStatus: resolveWorkflowStatus({
            sourceArchivedAt: row.archived_at,
            importId: row.ocr_import_id,
            importStatus: importRow?.queue_status ?? null,
            rowCount: detailRows.length,
            invalidDetailCount: detailRows.filter(
              (detail: { status: string; review_reason: string | null }) =>
                detail.status === "needs-review" &&
                detail.review_reason !== "商品対応を要確認",
            ).length,
            unmatchedProductCount: detailRows.filter(
              (detail: { product_id: string | null }) => detail.product_id === null,
            ).length,
            unconfirmedSalesCount: detailRows.filter(
              (detail: { sales_confirmed_at: string | null }) => detail.sales_confirmed_at === null,
            ).length,
          }),
        };
      }),
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
