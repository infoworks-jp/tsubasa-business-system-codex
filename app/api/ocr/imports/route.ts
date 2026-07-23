import { NextRequest, NextResponse } from "next/server";
import { saveOcrImport } from "@/lib/ocr/import-store";
import type {
  OcrImportDraftRow,
  OcrImportRecord,
  OcrImportSavedRow,
} from "@/lib/ocr/import-types";
import { getProductRepository } from "@/lib/products/get-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavePayload = {
  imageName?: unknown;
  engineId?: unknown;
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
      createdAt: new Date().toISOString(),
      rows: matchedRows,
      summary: {
        total: matchedRows.length,
        processed: matchedRows.filter((row) => row.status === "processed").length,
        needsReview: matchedRows.filter((row) => row.status === "needs-review").length,
      },
    };

    saveOcrImport(record);

    return NextResponse.json({
      message: "OCR取込データを保存しました",
      record,
    });
  } catch (error) {
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
