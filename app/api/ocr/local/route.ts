import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedApiUser } from "@/lib/auth/server";
import { recognizeLocally } from "@/lib/ocr/local-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FIXTURE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/tiff"]);

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedApiUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_FIXTURE_SIZE_BYTES) {
      return NextResponse.json({ error: "画像形式またはサイズを確認してください" }, { status: 400 });
    }

    const image = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(await recognizeLocally(image, file.name || "fixture-image"));
  } catch (error) {
    const status = error instanceof AuthRequiredError ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ローカルOCRに失敗しました" },
      { status },
    );
  }
}
