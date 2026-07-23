import { NextRequest, NextResponse } from "next/server";
import type {
  OcrImportDraftRow,
  OcrExecutionState,
  OcrImportQueueStatus,
  OcrImportRecord,
  OcrImportSavedRow,
} from "@/lib/ocr/import-types";
import { getProductRepository } from "@/lib/products/get-repository";
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
  confirmed_at: string | null;
  saved_at: string | null;
  error_message: string | null;
  total_count: number;
  processed_count: number;
  needs_review_count: number;
  ticket_ocr_import_rows?: ImportDetailRow[];
};

type ImportDetailRow = {
  id: string;
  product_name: string;
  quantity: number;
  amount: number;
  time_slot: string;
  product_id: string | null;
  status: string;
  review_reason: string | null;
};

function normalizeName(value: string) {
  return value.replace(/[\s　]/g, "").toLowerCase();
}

function toNumber(text: string) {
  const cleaned = text.replace(/[,，円\s]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseRows(raw: unknown): OcrImportDraftRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      return {
        productName: String(item.productName ?? "").trim(),
        quantity: String(item.quantity ?? "").trim(),
        amount: String(item.amount ?? "").trim(),
        timeSlot: String(item.timeSlot ?? "").trim(),
      };
    })
    .filter((row): row is OcrImportDraftRow => row !== null)
    .filter((row) => row.productName.length > 0 || row.quantity.length > 0 || row.amount.length > 0);
}

function parseBusinessDate(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function toSavedRow(row: ImportDetailRow): OcrImportSavedRow {
  return {
    id: String(row.id),
    productName: String(row.product_name),
    quantity: Number(row.quantity ?? 0),
    amount: Number(row.amount ?? 0),
    timeSlot: String(row.time_slot ?? ""),
    productId: row.product_id ? String(row.product_id) : null,
    status: row.status === "processed" ? "processed" : "needs-review",
    reviewReason: row.review_reason ? String(row.review_reason) : null,
  };
}

function toImportRecord(row: ImportHeaderRow): OcrImportRecord {
  return {
    id: String(row.id),
    imageName: String(row.image_name),
    engineId: String(row.engine_id),
    ocrState: row.ocr_state,
    queueStatus: row.queue_status,
    businessDate: String(row.business_date),
    createdAt: String(row.created_at),
    confirmedAt: row.confirmed_at,
    savedAt: row.saved_at,
    errorMessage: row.error_message,
    rows: (row.ticket_ocr_import_rows ?? []).map(toSavedRow),
    summary: {
      total: Number(row.total_count ?? 0),
      processed: Number(row.processed_count ?? 0),
      needsReview: Number(row.needs_review_count ?? 0),
    },
  };
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
      .select("id, image_name, engine_id, ocr_state, queue_status, business_date, created_at, confirmed_at, saved_at, error_message, total_count, processed_count, needs_review_count, ticket_ocr_import_rows(id, product_name, quantity, amount, time_slot, product_id, status, review_reason)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      throw new Error(error.message || "OCR取込キュー取得に失敗しました");
    }

    const records = (data as ImportHeaderRow[] | null)?.map(toImportRecord) ?? [];
    return NextResponse.json({ records });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SavePayload;
    const rows = parseRows(body.rows);

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

    const products = await getProductRepository().list({ active: "all" });
    const matchedRows: OcrImportSavedRow[] = rows.map((row, index) => {
      const normalized = normalizeName(row.productName);
      const matchedProduct =
        products.find((product) => normalizeName(product.productName) === normalized) ??
        products.find((product) => normalizeName(product.productName).includes(normalized));

      const productId = matchedProduct?.id ?? null;
      const status = productId ? "processed" : "needs-review";

      return {
        id: `ocr-row-${Date.now()}-${index + 1}`,
        productName: row.productName || "要確認",
        quantity: toNumber(row.quantity),
        amount: toNumber(row.amount),
        timeSlot: row.timeSlot || "要確認",
        productId,
        status,
        reviewReason: productId ? null : "商品マスター未登録のため要確認",
      };
    });

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
        confirmed_at: null,
        saved_at: null,
        error_message: null,
        total_count: record.summary.total,
        processed_count: record.summary.processed,
        needs_review_count: record.summary.needsReview,
      })
      .select("id, created_at, queue_status, business_date, confirmed_at, saved_at, error_message")
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
      product_id: row.productId,
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

    const persistedRows: OcrImportSavedRow[] = (insertedRows ?? []).map((row) =>
      toSavedRow(row as ImportDetailRow),
    );

    record.id = String(importData.id);
    record.createdAt = String(importData.created_at ?? record.createdAt);
    record.queueStatus = (importData.queue_status as OcrImportQueueStatus | undefined) ?? "new";
    record.businessDate = String(importData.business_date ?? record.businessDate);
    record.confirmedAt = importData.confirmed_at ?? null;
    record.savedAt = importData.saved_at ?? null;
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
