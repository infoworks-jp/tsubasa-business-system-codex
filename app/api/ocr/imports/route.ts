import { NextRequest, NextResponse } from "next/server";
import type {
  OcrExecutionState,
  OcrImportQueueStatus,
  OcrImportRecord,
  OcrImportSavedRow,
} from "@/lib/ocr/import-types";
import { parseBusinessDate, parseRows, toNumber, toSavedRow, type OcrImportDbRow } from "@/lib/ocr/import-utils";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavePayload = {
  imageName?: unknown;
  engineId?: unknown;
  ocrState?: unknown;
  businessDate?: unknown;
  rows?: unknown;
};

type ImportHeaderRow = {
  id: string;
  image_name: string;
  engine_id: string;
  ocr_state: OcrExecutionState;
  queue_status: OcrImportQueueStatus;
  business_date: string;
  created_at: string;
  error_message: string | null;
  total_count: number;
  processed_count: number;
  needs_review_count: number;
  ticket_ocr_import_rows?: ImportDetailRow[];
};

type ImportDetailRow = OcrImportDbRow;

function toImportRecord(row: ImportHeaderRow): OcrImportRecord {
  return {
    id: String(row.id),
    imageName: String(row.image_name),
    engineId: String(row.engine_id),
    ocrState: row.ocr_state,
    queueStatus: row.queue_status,
    businessDate: String(row.business_date),
    createdAt: String(row.created_at),
    confirmedAt: null,
    savedAt: null,
    errorMessage: row.error_message,
    rows: (row.ticket_ocr_import_rows ?? []).map(toSavedRow),
    summary: {
      total: Number(row.total_count ?? 0),
      processed: Number(row.processed_count ?? 0),
      needsReview: Number(row.needs_review_count ?? 0),
    },
  };
}

function queueOrder(status: OcrImportQueueStatus) {
  if (status === "needs-review") return 0;
  if (status === "new") return 1;
  if (status === "error") return 2;
  return 3;
}

function mapErrorResponse(error: unknown) {
  if (error instanceof SupabaseNotConfiguredError) {
    return NextResponse.json(
      {
        code: "SUPABASE_NOT_CONFIGURED",
        message: "接続未設定: Supabase接続情報を設定してください。",
      },
      { status: 503 },
    );
  }

  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("permission denied")) {
      return NextResponse.json(
        {
          code: "SUPABASE_PERMISSION_DENIED",
          message: "保存先テーブルへの権限が不足しています。",
          detail: message,
          todo: "TODO: OCR保存用マイグレーション適用後に imports/rows の RLS を確認してください。",
        },
        { status: 503 },
      );
    }

    if (
      message.includes("relation") ||
      message.includes("does not exist") ||
      message.includes("schema cache")
    ) {
      return NextResponse.json(
        {
          code: "SUPABASE_NOT_CONFIGURED",
          message: "接続未設定: Supabase保存先テーブルが未設定です。",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      message:
        error instanceof Error
          ? error.message
          : "OCR取込データの処理に失敗しました",
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from("ticket_ocr_imports")
      .select("id, image_name, engine_id, ocr_state, queue_status, business_date, created_at, error_message, total_count, processed_count, needs_review_count, ticket_ocr_import_rows(id, product_name, quantity, amount, time_slot, product_id, status, review_reason)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      throw new Error(error.message || "OCR取込キュー取得に失敗しました");
    }

    const records = (data as ImportHeaderRow[] | null)?.map(toImportRecord) ?? [];
    records.sort((a, b) => {
      const statusDiff = queueOrder(a.queueStatus) - queueOrder(b.queueStatus);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return NextResponse.json({ records });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SavePayload;
    const rows = parseRows(body.rows, { mode: "draft" });

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "保存対象の行がありません" },
        { status: 400 },
      );
    }

    const imageName = String(body.imageName ?? "uploaded-image");
    const engineId = String(body.engineId ?? "unknown");
    const ocrState = String(body.ocrState ?? "not-run") as OcrExecutionState;
    const businessDate = parseBusinessDate(body.businessDate);

    const matchedRows: OcrImportSavedRow[] = rows.map((row, index) => ({
      id: `ocr-row-${Date.now()}-${index + 1}`,
      productName: row.productName || "要確認",
      quantity: toNumber(row.quantity),
      amount: toNumber(row.amount),
      timeSlot: row.timeSlot || "要確認",
      productId: null,
      status: "needs-review",
      reviewReason: "OCR保存後に確認してください",
    }));

    const record: OcrImportRecord = {
      id: `ocr-import-${Date.now()}`,
      imageName,
      engineId,
      ocrState,
      queueStatus: "new",
      businessDate,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      savedAt: null,
      errorMessage: null,
      rows: matchedRows,
      summary: {
        total: matchedRows.length,
        processed: matchedRows.filter((row) => row.status === "processed").length,
        needsReview: matchedRows.filter((row) => row.status === "needs-review").length,
      },
    };

    const client = getSupabaseServerClient();

    const { data: importData, error: importError } = await client
      .from("ticket_ocr_imports")
      .insert({
        image_name: imageName,
        engine_id: engineId,
        ocr_state: ocrState,
        queue_status: "new",
        business_date: businessDate,
        error_message: null,
        total_count: record.summary.total,
        processed_count: record.summary.processed,
        needs_review_count: record.summary.needsReview,
      })
        .select("id, created_at, queue_status, business_date, error_message")
      .single();

    if (importError || !importData) {
      throw new Error(importError?.message || "OCR取込ヘッダの保存に失敗しました");
    }

    const rowsPayload = matchedRows.map((row, index) => ({
      import_id: importData.id,
      row_no: index + 1,
      product_name: row.productName,
      quantity: row.quantity,
      amount: row.amount,
      time_slot: row.timeSlot,
      product_id: null,
      status: row.status,
      review_reason: row.reviewReason,
    }));

    const { data: insertedRows, error: rowsError } = await client
      .from("ticket_ocr_import_rows")
      .insert(rowsPayload)
      .select("id, product_name, quantity, amount, time_slot, product_id, status, review_reason");

    if (rowsError) {
      throw new Error(rowsError.message || "OCR取込明細の保存に失敗しました");
    }

    const persistedRows = (insertedRows ?? []).map((row) => toSavedRow(row as OcrImportDbRow));

    record.id = String(importData.id);
    record.createdAt = String(importData.created_at ?? record.createdAt);
    record.queueStatus = (importData.queue_status as OcrImportQueueStatus | undefined) ?? "new";
    record.businessDate = String(importData.business_date ?? record.businessDate);
    record.confirmedAt = null;
    record.savedAt = null;
    record.errorMessage = importData.error_message ?? null;
    record.rows = persistedRows;

    return NextResponse.json({
      message: "OCR取込データを保存しました",
      record,
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}
