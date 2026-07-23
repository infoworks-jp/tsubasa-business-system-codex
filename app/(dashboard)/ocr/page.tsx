import { OcrValidationPanel } from "@/components/ocr-validation-panel";

export const dynamic = "force-dynamic";

export default function OcrPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">OCR validation</p>
          <h1>OCR検証</h1>
          <p className="lead">券売機ジャーナル画像から読み取った内容を確認します。</p>
        </div>
      </header>
      <OcrValidationPanel />
    </>
  );
}
