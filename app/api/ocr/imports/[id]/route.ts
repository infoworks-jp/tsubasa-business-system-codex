import { NextRequest, NextResponse } from "next/server";
import type {
  OcrExecutionState,
  OcrImportQueueStatus,
  OcrImportRecord,
  OcrImportSavedRow,
} from "@/lib/ocr/import-types";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdatePayload = {
  action?: unknown;
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

type RowValidationResult = {
  status: "processed" | "needs-review";
  reviewReason: string | null;
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

function toNumber(text: string) {
  const cleaned = text.replace(/[,，円\s]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseBusinessDate(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function parseRows(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const productName = String(item.productName ?? "").trim();
      const quantity = String(item.quantity ?? "").trim();
      const amount = String(item.amount ?? "").trim();
      const timeSlot = String(item.timeSlot ?? "").trim();
      if ([productName, quantity, amount, timeSlot].every((value) => value.length === 0)) {
        return null;
      }
      return {
        productName: productName || "要確認",
        quantity: toNumber(quantity),
        amount: toNumber(amount),
        timeSlot: timeSlot || "要確認",
      };
    })
    .filter((row): row is { productName: string; quantity: number; amount: number; timeSlot: string } => row !== null);
}

function validateRowFields(productName: string, quantity: number, amount: number, timeSlot: string): RowValidationResult {
  const errors: string[] = [];
  if (!productName.trim()) errors.push("商品名が未入力");
  if (!Number.isFinite(quantity) || quantity < 1) errors.push("数量は1以上が必要");
  if (!Number.isFinite(amount) || amount <= 0) errors.push("金額は0円より大きい値が必要");
  if (!timeSlot.trim()) errors.push("時間帯が未入力");

  if (errors.length === 0) {
    return { status: "processed", reviewReason: null };
  }

  return {
    status: "needs-review",
    reviewReason: errors.join(" / "),
  };
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

async function fetchImport(client: ReturnType<typeof getSupabaseServerClient>, importId: string) {
  const { data, error } = await client
    .from("ticket_ocr_imports")
    .select("id, image_name, engine_id, ocr_state, queue_status, business_date, created_at, error_message, total_count, processed_count, needs_review_count, ticket_ocr_import_rows(id, product_name, quantity, amount, time_slot, product_id, status, review_reason)")
    .eq("id", importId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "取込データの取得に失敗しました");
  }

  return data as ImportHeaderRow;
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as UpdatePayload;
    const params = await context.params;
    const importId = String(params.id ?? "").trim();

    if (!importId) {
      return NextResponse.json({ message: "取込IDが必要です" }, { status: 400 });
    }

    const client = getSupabaseServerClient();

    const action = String(body.action ?? "").trim();
    if (action === "confirm") {
      const current = await fetchImport(client, importId);
      const currentRows = current.ticket_ocr_import_rows ?? [];

      if (currentRows.length === 0) {
        return NextResponse.json({ message: "確認対象の行がありません" }, { status: 409 });
      }

      const validatedRows = currentRows.map((row) => {
        const validation = validateRowFields(
          String(row.product_name ?? ""),
          Number(row.quantity ?? 0),
          Number(row.amount ?? 0),
          String(row.time_slot ?? ""),
        );
        return {
          id: row.id,
          status: validation.status,
          reviewReason: validation.reviewReason,
        };
      });

      await Promise.all(
        validatedRows.map((row) =>
          client
            .from("ticket_ocr_import_rows")
            .update({ status: row.status, review_reason: row.reviewReason })
            .eq("id", row.id),
        ),
      );

      const needsReviewCount = validatedRows.filter((row) => row.status === "needs-review").length;
      const processedCount = validatedRows.length - needsReviewCount;
      const queueStatus: OcrImportQueueStatus = needsReviewCount > 0 ? "needs-review" : "confirmed";
      const errorMessage =
        needsReviewCount > 0
          ? "入力不備があるため要確認で停止しました"
          : null;

      const { error: updateHeaderError } = await client
        .from("ticket_ocr_imports")
        .update({
          queue_status: queueStatus,
          processed_count: processedCount,
          needs_review_count: needsReviewCount,
          error_message: errorMessage,
        })
        .eq("id", importId);

      if (updateHeaderError) {
        throw new Error(updateHeaderError.message || "確認済状態の更新に失敗しました");
      }

      const refreshed = await fetchImport(client, importId);
      return NextResponse.json(
        {
          message:
            queueStatus === "confirmed"
              ? "確認済みに更新しました"
              : "入力不備があるため要確認で停止しました",
          record: toImportRecord(refreshed),
        },
        queueStatus === "confirmed" ? undefined : { status: 409 },
      );
    }

    const rows = parseRows(body.rows);
    if (rows.length === 0) {
      return NextResponse.json({ message: "保存対象の行がありません" }, { status: 400 });
    }

    const currentHeader = await fetchImport(client, importId);
    const editStatus: OcrImportQueueStatus =
      currentHeader.queue_status === "confirmed" ? "needs-review" : "new";

    const imageName = String(body.imageName ?? "uploaded-image");
    const engineId = String(body.engineId ?? "unknown");
    const ocrState = String(body.ocrState ?? "not-run") as OcrExecutionState;
    const businessDate = parseBusinessDate(body.businessDate);

    const rowsPayload = rows.map((row, index) => {
      const validation = validateRowFields(
        row.productName,
        row.quantity,
        row.amount,
        row.timeSlot,
      );
      return {
        import_id: importId,
        row_no: index + 1,
        product_name: row.productName,
        quantity: row.quantity,
        amount: row.amount,
        time_slot: row.timeSlot,
        product_id: null,
        status: validation.status,
        review_reason: validation.reviewReason,
      };
    });

    const needsReviewCount = rowsPayload.filter((row) => row.status === "needs-review").length;
    const processedCount = rowsPayload.length - needsReviewCount;
    const queueStatus: OcrImportQueueStatus =
      editStatus === "needs-review"
        ? "needs-review"
        : needsReviewCount > 0
          ? "needs-review"
          : "new";
    const errorMessage =
      currentHeader.queue_status === "confirmed"
        ? "確認済みデータを再編集したため、再確認が必要です"
        : queueStatus === "needs-review"
          ? "入力不備があるため要確認です"
          : null;

    const { error: updateHeaderError } = await client
      .from("ticket_ocr_imports")
      .update({
        image_name: imageName,
        engine_id: engineId,
        ocr_state: ocrState,
        queue_status: queueStatus,
        business_date: businessDate,
        total_count: rowsPayload.length,
        processed_count: processedCount,
        needs_review_count: needsReviewCount,
        error_message: errorMessage,
      })
      .eq("id", importId);

    if (updateHeaderError) {
      throw new Error(updateHeaderError.message || "OCR取込ヘッダの更新に失敗しました");
    }

    const { error: deleteRowsError } = await client
      .from("ticket_ocr_import_rows")
      .delete()
      .eq("import_id", importId);

    if (deleteRowsError) {
      throw new Error(deleteRowsError.message || "OCR取込明細の更新準備に失敗しました");
    }

    const { error: insertRowsError } = await client
      .from("ticket_ocr_import_rows")
      .insert(rowsPayload);

    if (insertRowsError) {
      throw new Error(insertRowsError.message || "OCR取込明細の更新に失敗しました");
    }

    const refreshed = await fetchImport(client, importId);

    return NextResponse.json({
      message: "OCR取込データを更新しました",
      record: toImportRecord(refreshed),
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const importId = String(params.id ?? "").trim();

    if (!importId) {
      return NextResponse.json({ message: "取込IDが必要です" }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { error } = await client
      .from("ticket_ocr_imports")
      .delete()
      .eq("id", importId);

    if (error) {
      throw new Error(error.message || "OCR取込データの削除に失敗しました");
    }

    return NextResponse.json({ message: "OCR取込データを削除しました" });
  } catch (error) {
    return mapErrorResponse(error);
  }
}
