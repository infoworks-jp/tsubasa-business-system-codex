import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import type {
  OcrExecutionState,
  OcrImportQueueStatus,
  OcrImportRecord,
} from "@/lib/ocr/import-types";
import { parseBusinessDate, parseRows, toSavedRow, type OcrImportDbRow } from "@/lib/ocr/import-utils";
import { getAuthenticatedSupabaseClient } from "@/lib/original-sources/server";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdatePayload = {
  action?: unknown;
  imageName?: unknown;
  engineId?: unknown;
  ocrState?: unknown;
  rawText?: unknown;
  ocrConfidence?: unknown;
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
  archived_at: string | null;
  ocr_raw_text: string | null;
  ocr_confidence: number | null;
  ticket_ocr_import_rows?: ImportDetailRow[];
};

type RowValidationResult = {
  status: "processed" | "needs-review";
  reviewReason: string | null;
};

type ImportDetailRow = OcrImportDbRow;

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

function toImportRecord(row: ImportHeaderRow): OcrImportRecord {
  return {
    id: String(row.id),
    imageName: String(row.image_name),
    engineId: String(row.engine_id),
    ocrState: row.ocr_state,
    queueStatus: row.queue_status,
    businessDate: String(row.business_date),
    createdAt: String(row.created_at),
    archivedAt: row.archived_at,
    confirmedAt: null,
    savedAt: null,
    errorMessage: row.error_message,
    rawText: row.ocr_raw_text,
    ocrConfidence: row.ocr_confidence,
    rows: (row.ticket_ocr_import_rows ?? []).map(toSavedRow),
    summary: {
      total: Number(row.total_count ?? 0),
      processed: Number(row.processed_count ?? 0),
      needsReview: Number(row.needs_review_count ?? 0),
    },
  };
}

function mergeReviewReason(baseReason: string | null, extraReason: string | null) {
  if (!baseReason && !extraReason) return null;
  if (!baseReason) return extraReason;
  if (!extraReason) return baseReason;
  return `${baseReason} / ${extraReason}`;
}

async function rebuildSalesTotals(client: ReturnType<typeof getAuthenticatedSupabaseClient>) {
  const { error } = await client.rpc("rebuild_ticket_product_sales_totals");
  if (error) {
    throw new Error(error.message || "売上集計の再構築に失敗しました");
  }
}

async function fetchImport(client: ReturnType<typeof getAuthenticatedSupabaseClient>, importId: string) {
  const { data, error } = await client
    .from("ticket_ocr_imports")
    .select("id, image_name, engine_id, ocr_state, queue_status, business_date, created_at, error_message, total_count, processed_count, needs_review_count, archived_at, ocr_raw_text, ocr_confidence, ticket_ocr_import_rows(id, product_name, quantity, amount, time_slot, product_id, status, review_reason)")
    .eq("id", importId)
    .is("ticket_ocr_import_rows.archived_at", null)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "取込データの取得に失敗しました");
  }

  return data as ImportHeaderRow;
}

function mapErrorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json(
      {
        code: "AUTH_REQUIRED",
        message: error.message,
      },
      { status: 401 },
    );
  }

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
    await requireAuthenticatedApiUser(request);
    const body = (await request.json()) as UpdatePayload;
    const params = await context.params;
    const importId = String(params.id ?? "").trim();

    if (!importId) {
      return NextResponse.json({ message: "取込IDが必要です" }, { status: 400 });
    }

    const client = getAuthenticatedSupabaseClient(request);

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
        const resolved = row.product_id
          ? { productId: String(row.product_id), reason: null as string | null }
          : { productId: null as string | null, reason: "商品対応を要確認" };
        const reviewReason = mergeReviewReason(validation.reviewReason, resolved.reason);
        const status = reviewReason ? "needs-review" : "processed";

        return {
          id: row.id,
          productId: resolved.productId,
          status,
          reviewReason,
        };
      });

      await Promise.all(
        validatedRows.map((row) =>
          client
            .from("ticket_ocr_import_rows")
            .update({
              product_id: row.productId,
              status: row.status,
              review_reason: row.reviewReason,
            })
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

      await rebuildSalesTotals(client);

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

    const rows = parseRows(body.rows, { mode: "validated" });
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
    const rawText = typeof body.rawText === "string" ? body.rawText : null;
    const ocrConfidence =
      typeof body.ocrConfidence === "number" && Number.isFinite(body.ocrConfidence)
        ? body.ocrConfidence
        : null;

    const rowsPayload = rows.map((row, index) => {
      const validation = validateRowFields(
        row.productName,
        row.quantity,
        row.amount,
        row.timeSlot,
      );
      const resolved = { productId: null as string | null, reason: "商品対応を要確認" };
      const reviewReason = mergeReviewReason(validation.reviewReason, resolved.reason);
      const status = reviewReason ? "needs-review" : "processed";

      return {
        import_id: importId,
        row_no: index + 1,
        product_name: row.productName,
        original_product_name: row.productName,
        quantity: row.quantity,
        amount: row.amount,
        time_slot: row.timeSlot,
        product_id: resolved.productId,
        status,
        review_reason: reviewReason,
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
        ...(currentHeader.ocr_raw_text === null && rawText !== null
          ? { ocr_raw_text: rawText, ocr_confidence: ocrConfidence }
          : {}),
      })
      .eq("id", importId);

    if (updateHeaderError) {
      throw new Error(updateHeaderError.message || "OCR取込ヘッダの更新に失敗しました");
    }

    const { error: archiveRowsError } = await client
      .from("ticket_ocr_import_rows")
      .update({
        archived_at: new Date().toISOString(),
        archived_reason: "OCR取込明細の再編集",
      })
      .eq("import_id", importId);

    if (archiveRowsError) {
      throw new Error(archiveRowsError.message || "OCR取込明細の更新準備に失敗しました");
    }

    const { error: insertRowsError } = await client
      .from("ticket_ocr_import_rows")
      .insert(rowsPayload);

    if (insertRowsError) {
      throw new Error(insertRowsError.message || "OCR取込明細の更新に失敗しました");
    }

    await rebuildSalesTotals(client);

    const refreshed = await fetchImport(client, importId);

    return NextResponse.json({
      message: "OCR取込データを更新しました",
      record: toImportRecord(refreshed),
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedApiUser(request);
    const params = await context.params;
    const importId = String(params.id ?? "").trim();

    if (!importId) {
      return NextResponse.json({ message: "取込IDが必要です" }, { status: 400 });
    }

    const client = getAuthenticatedSupabaseClient(request);
    const { error } = await client
      .from("ticket_ocr_imports")
      .update({
        queue_status: "archived",
        archived_at: new Date().toISOString(),
        archived_reason: "ユーザー操作でアーカイブ",
      })
      .eq("id", importId);

    if (error) {
      throw new Error(error.message || "OCR取込データのアーカイブに失敗しました");
    }

    await rebuildSalesTotals(client);

    return NextResponse.json({ message: "OCR取込データをアーカイブしました" });
  } catch (error) {
    return mapErrorResponse(error);
  }
}
