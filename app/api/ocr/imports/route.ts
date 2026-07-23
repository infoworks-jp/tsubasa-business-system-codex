import { NextRequest, NextResponse } from "next/server";
import type {
  OcrImportDraftRow,
  OcrExecutionState,
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
  rows?: unknown;
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
      createdAt: new Date().toISOString(),
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
        total_count: record.summary.total,
        processed_count: record.summary.processed,
        needs_review_count: record.summary.needsReview,
      })
      .select("id, created_at")
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

    const persistedRows: OcrImportSavedRow[] = (insertedRows ?? []).map((row) => ({
      id: String(row.id),
      productName: String(row.product_name),
      quantity: Number(row.quantity ?? 0),
      amount: Number(row.amount ?? 0),
      timeSlot: String(row.time_slot ?? ""),
      productId: row.product_id ? String(row.product_id) : null,
      status: row.status === "processed" ? "processed" : "needs-review",
      reviewReason: row.review_reason ? String(row.review_reason) : null,
    }));

    record.id = String(importData.id);
    record.createdAt = String(importData.created_at ?? record.createdAt);
    record.rows = persistedRows;

    return NextResponse.json({
      message: "OCR取込データを保存しました",
      record,
    });
  } catch (error) {
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
            : "OCR取込データの保存に失敗しました",
      },
      { status: 500 },
    );
  }
}
