import { NextRequest, NextResponse } from "next/server";
import { normalizeOpenAiResponse, parseOcrResponseText } from "@/lib/ocr/openai-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    const imageName = file.name || "uploaded-image";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY が未設定です。ローカル環境の .env.local で設定してください。",
        },
        { status: 500 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "あなたは券売機ジャーナルの OCR アシスタントです。与えられた画像から、商品名、数量、金額、時間、日計を抽出してください。読み取れない値は空文字にしてください。JSON 形式で次の構造を返してください: {summary:string, fields:[{key:'productName'|'quantity'|'amount'|'timeSlot'|'dailyTotal', label:string, value:string, confidence:number, box:{x:number,y:number,width:number,height:number}}]}",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: `data:${file.type || "image/png"};base64,${base64}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const payload = await response.json();
    const text = payload.output_text || "";
    const parsed = parseOcrResponseText(text);
    return NextResponse.json(normalizeOpenAiResponse(parsed, imageName));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR処理に失敗しました" },
      { status: 500 },
    );
  }
}
