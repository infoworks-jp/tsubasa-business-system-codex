import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "外部OCRは無効です。/api/ocr/local を使用してください。" },
    { status: 410 },
  );
}
