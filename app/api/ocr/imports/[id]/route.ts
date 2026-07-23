import { NextRequest, NextResponse } from "next/server";
import type { OcrExecutionState, OcrImportQueueStatus, OcrImportRecord, OcrImportSavedRow } from "@/lib/ocr/import-types";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionPayload = {
  action?: unknown;
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
};

type ImportRow = {
  id: string;
  import_id: string;
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

function toSavedRow(row: ImportRow): OcrImportSavedRow {
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

function toRecord(header: ImportHeaderRow, rows: ImportRow[]): OcrImportRecord {
  return {
    id: String(header.id),
    imageName: String(header.image_name),
    engineId: String(header.engine_id),
    ocrState: header.ocr_state,
    queueStatus: header.queue_status,
    businessDate: String(header.business_date),
    createdAt: String(header.created_at),
    confirmedAt: header.confirmed_at,
    savedAt: header.saved_at,
    errorMessage: header.error_message,
    rows: rows.map(toSavedRow),
    summary: {
      total: Number(header.total_count ?? 0),
      processed: Number(header.processed_count ?? 0),
      needsReview: Number(header.needs_review_count ?? 0),
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
          : "OCR取込キューの処理に失敗しました",
    },
    { status: 500 },
  );
}

async function getImportWithRows(importId: string) {
  const client = getSupabaseServerClient();

  const { data: headerData, error: headerError } = await client
    .from("ticket_ocr_imports")
    .select("id, image_name, engine_id, ocr_state, queue_status, business_date, created_at, confirmed_at, saved_at, error_message, total_count, processed_count, needs_review_count")
    .eq("id", importId)
    .single();

  if (headerError || !headerData) {
    throw new Error(headerError?.message || "取込キューが見つかりません");
  }

  const { data: rowsData, error: rowsError } = await client
    .from("ticket_ocr_import_rows")
    .select("id, import_id, product_name, quantity, amount, time_slot, product_id, status, review_reason")
    .eq("import_id", importId)
    .order("row_no", { ascending: true });

  if (rowsError) {
    throw new Error(rowsError.message || "取込明細の取得に失敗しました");
  }

  return {
    client,
    header: headerData as ImportHeaderRow,
    rows: (rowsData ?? []) as ImportRow[],
  };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as ActionPayload;
    const action = String(body.action ?? "").trim();
    const params = await context.params;
    const importId = String(params.id ?? "").trim();

    if (!importId) {
      return NextResponse.json({ message: "取込IDが必要です" }, { status: 400 });
    }

    if (action !== "confirm" && action !== "register") {
      return NextResponse.json({ message: "不正な操作です" }, { status: 400 });
    }

    const { client, header, rows } = await getImportWithRows(importId);

    if (action === "confirm") {
      const now = new Date().toISOString();
      const { error: updateError } = await client
        .from("ticket_ocr_imports")
        .update({
          queue_status: "confirmed",
          confirmed_at: now,
          error_message: null,
        })
        .eq("id", importId);

      if (updateError) {
        throw new Error(updateError.message || "確認済への更新に失敗しました");
      }

      const refreshed = await getImportWithRows(importId);
      return NextResponse.json({
        message: "Import Queueを確認済に更新しました",
        record: toRecord(refreshed.header, refreshed.rows),
      });
    }

    if (header.queue_status !== "confirmed") {
      return NextResponse.json(
        { message: "保存処理の前に、Import Queueを確認済にしてください" },
        { status: 409 },
      );
    }

    const products = await getProductRepository().list({ active: "all" });

    const rematchedRows = rows.map((row) => {
      const normalized = normalizeName(row.product_name);
      const matchedProduct =
        products.find((product) => normalizeName(product.productName) === normalized) ??
        products.find((product) => normalizeName(product.productName).includes(normalized));

      const productId = matchedProduct?.id ?? null;
      const status = productId ? "processed" : "needs-review";
      const reviewReason = productId ? null : "商品マスター未登録のため要確認";

      return {
        ...row,
        product_id: productId,
        status,
        review_reason: reviewReason,
      };
    });

    await Promise.all(
      rematchedRows.map((row) =>
        client
          .from("ticket_ocr_import_rows")
          .update({
            product_id: row.product_id,
            status: row.status,
            review_reason: row.review_reason,
          })
          .eq("id", row.id),
      ),
    );

    const needsReviewCount = rematchedRows.filter((row) => row.status === "needs-review").length;
    const processedCount = rematchedRows.length - needsReviewCount;

    if (needsReviewCount > 0) {
      const { error: headerUpdateError } = await client
        .from("ticket_ocr_imports")
        .update({
          queue_status: "error",
          processed_count: processedCount,
          needs_review_count: needsReviewCount,
          error_message: "商品マスター未登録の商品があるため、要確認で停止しました",
        })
        .eq("id", importId);

      if (headerUpdateError) {
        throw new Error(headerUpdateError.message || "Import Queue更新に失敗しました");
      }

      const refreshed = await getImportWithRows(importId);
      return NextResponse.json(
        {
          message: "未確認データを検出したため、要確認で停止しました",
          record: toRecord(refreshed.header, refreshed.rows),
        },
        { status: 409 },
      );
    }

    const merged = new Map<string, { quantity: number; amount: number }>();
    for (const row of rematchedRows) {
      if (!row.product_id) continue;
      const current = merged.get(row.product_id) ?? { quantity: 0, amount: 0 };
      current.quantity += Number(row.quantity ?? 0);
      current.amount += Number(row.amount ?? 0);
      merged.set(row.product_id, current);
    }

    const productIds = [...merged.keys()];
    if (productIds.length > 0) {
      const { data: existingRows, error: existingError } = await client
        .from("ticket_product_sales_totals")
        .select("id, product_id, quantity, amount")
        .eq("business_date", header.business_date)
        .in("product_id", productIds);

      if (existingError) {
        throw new Error(existingError.message || "商品別集計の取得に失敗しました");
      }

      const existingMap = new Map<string, { quantity: number; amount: number }>();
      for (const row of existingRows ?? []) {
        existingMap.set(String(row.product_id), {
          quantity: Number(row.quantity ?? 0),
          amount: Number(row.amount ?? 0),
        });
      }

      const upsertRows = productIds.map((productId) => {
        const add = merged.get(productId) ?? { quantity: 0, amount: 0 };
        const base = existingMap.get(productId) ?? { quantity: 0, amount: 0 };
        return {
          business_date: header.business_date,
          product_id: productId,
          quantity: base.quantity + add.quantity,
          amount: base.amount + add.amount,
          source_import_id: importId,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: upsertError } = await client
        .from("ticket_product_sales_totals")
        .upsert(upsertRows, { onConflict: "business_date,product_id" });

      if (upsertError) {
        throw new Error(upsertError.message || "商品別集計への反映に失敗しました");
      }
    }

    const now = new Date().toISOString();
    const { error: saveError } = await client
      .from("ticket_ocr_imports")
      .update({
        queue_status: "saved",
        processed_count: processedCount,
        needs_review_count: 0,
        saved_at: now,
        error_message: null,
      })
      .eq("id", importId);

    if (saveError) {
      throw new Error(saveError.message || "保存済への更新に失敗しました");
    }

    const refreshed = await getImportWithRows(importId);
    return NextResponse.json({
      message: "売上集計への登録が完了しました",
      record: toRecord(refreshed.header, refreshed.rows),
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}
