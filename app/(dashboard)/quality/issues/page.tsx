import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getQualityIssues,
  qualityLabels,
  type QualityIssueType,
} from "@/lib/quality/mock-data";

type SearchParams = Promise<{ type?: string }>;

const validTypes: QualityIssueType[] = [
  "unconfirmed",
  "salesDepositGap",
  "unmappedProduct",
  "duplicateDate",
  "mondayConflict",
];

export default async function QualityIssuesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedType = validTypes.includes(params.type as QualityIssueType)
    ? (params.type as QualityIssueType)
    : "unconfirmed";

  const issues = getQualityIssues(selectedType);

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Quality issues</p>
          <h1>{qualityLabels[selectedType]}一覧</h1>
          <p className="lead">該当するデータを確認し、必要な画面へ移動してください。</p>
        </div>
        <Link className="button secondary" href="/quality">
          <ArrowLeft size={17} aria-hidden="true" /> ダッシュボードへ戻る
        </Link>
      </header>

      <section className="card panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>日付</th>
                <th>データ種別</th>
                <th>状態</th>
                <th>内容</th>
                <th>差額</th>
                <th>遷移先</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">該当データはありません。</div>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>
                      <strong>{issue.id}</strong>
                    </td>
                    <td>{issue.date}</td>
                    <td>{issue.source}</td>
                    <td>
                      <span
                        className={`status ${
                          issue.status === "processed"
                            ? "success"
                            : issue.status === "needs-review"
                              ? "warning"
                              : "danger"
                        }`}
                      >
                        {issue.status === "processed"
                          ? "処理済み"
                          : issue.status === "needs-review"
                            ? "要確認"
                            : "エラー"}
                      </span>
                    </td>
                    <td>
                      <div>{issue.title}</div>
                      <span className="muted">{issue.detail}</span>
                    </td>
                    <td>
                      {issue.amountYen === undefined
                        ? "―"
                        : `¥${issue.amountYen.toLocaleString("ja-JP")}`}
                    </td>
                    <td>
                      <Link className="button secondary" href={issue.href}>
                        該当画面へ
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
