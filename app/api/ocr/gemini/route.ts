import { NextRequest, NextResponse } from "next/server";
import {
  normalizeOpenAiResponse,
  parseOcrResponseText,
} from "@/lib/ocr/openai-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY が未設定です。ローカル環境の .env.local で設定してください。",
        },
        { status: 500 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: file.type || "image/png",
                    data: base64,
                  },
                },
                {
                  text: "次のJSON形式で返してください: {summary:string, fields:[{key:'productName'|'quantity'|'amount'|'timeSlot'|'dailyTotal', label:string, value:string, confidence:number, box:{x:number,y:number,width:number,height:number}}]}。読み取れない値は空文字にしてください。",
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const payload = await response.json();
    const text =
      payload.candidates
        ?.at(0)
        ?.content?.parts?.find((part: { text?: string }) => part.text)?.text || "";
    const parsed = parseOcrResponseText(text);
    return NextResponse.json(normalizeOpenAiResponse(parsed, file.name || "uploaded-image"));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR処理に失敗しました" },
      { status: 500 },
    );
  }
}
