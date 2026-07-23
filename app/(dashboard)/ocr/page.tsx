import { OcrValidationPanel } from "@/components/ocr-validation-panel";

export const dynamic = "force-dynamic";

export default function OcrPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Ticket journal OCR</p>
          <h1>券売機OCR取込</h1>
          <p className="lead">券売機ジャーナル画像を取り込み、OCR結果の確認・修正・保存を行います。</p>
        </div>
      </header>
      <OcrValidationPanel />
    </>
  );
}
