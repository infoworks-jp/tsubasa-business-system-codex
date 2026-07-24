import { SourceFileManager } from "@/components/source-file-manager";
import { WorkflowNavigation } from "@/components/workflow-navigation";

export default function SourceFilesPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Original source files</p>
          <h1>原本保存・取込基盤</h1>
          <p className="lead">
            原本を改変せず非公開領域へ保存し、ハッシュと関連取込を追跡します。
          </p>
        </div>
        <span className="badge">認証済み利用者のみ</span>
      </div>
      <WorkflowNavigation />
      <SourceFileManager />
    </>
  );
}
