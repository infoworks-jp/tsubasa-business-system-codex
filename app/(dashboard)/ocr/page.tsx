import { OcrValidationPanel } from "@/components/ocr-validation-panel";
import { WorkflowNavigation } from "@/components/workflow-navigation";

export const dynamic = "force-dynamic";

type OcrPageProps = {
  searchParams: Promise<{
    sourceId?: string;
    importId?: string;
    sourceName?: string;
  }>;
};

export default async function OcrPage({ searchParams }: OcrPageProps) {
  const { sourceId, importId, sourceName } = await searchParams;

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Ticket journal OCR</p>
          <h1>券売機OCR取込</h1>
          <p className="lead">券売機ジャーナル画像を取り込み、OCR結果の確認・修正・保存を行います。</p>
        </div>
      </header>
      <WorkflowNavigation />
      <OcrValidationPanel
        initialImportId={importId}
        initialSourceId={sourceId}
        initialSourceName={sourceName}
      />
    </>
  );
}
