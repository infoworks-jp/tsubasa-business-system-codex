import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX, Link2 } from "lucide-react";
import { qualityMetricCounts, qualityStatusCounts } from "@/lib/quality/mock-data";

export default function QualityDashboardPage() {
  const metrics = qualityMetricCounts();
  const statuses = qualityStatusCounts();

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Quality dashboard</p>
          <h1>品質検証ダッシュボード</h1>
          <p className="lead">
            券売機データ、通帳データ、売上集計の不整合や未確認項目を一覧で確認します。
          </p>
        </div>
        <span className="badge">差異・未確認の早期把握</span>
      </header>

      <section className="grid metrics quality-metrics" aria-label="品質指標">
        <MetricCard
          title="未確認データ件数"
          value={`${metrics.unconfirmed}件`}
          note="確認待ちのデータ"
          href="/quality/issues?type=unconfirmed"
        />
        <MetricCard
          title="売上と入金の差額"
          value={`¥${metrics.salesDepositGap.toLocaleString("ja-JP")}`}
          note="照合差額の合計"
          href="/quality/issues?type=salesDepositGap"
        />
        <MetricCard
          title="商品マスター未登録件数"
          value={`${metrics.unmappedProduct}件`}
          note="未対応の商品コード"
          href="/quality/issues?type=unmappedProduct"
        />
        <MetricCard
          title="日付重複件数"
          value={`${metrics.duplicateDate}件`}
          note="重複登録の疑い"
          href="/quality/issues?type=duplicateDate"
        />
        <MetricCard
          title="月曜休業ルールとの矛盾件数"
          value={`${metrics.mondayConflict}件`}
          note="予定と実績の不一致"
          href="/quality/issues?type=mondayConflict"
        />
      </section>

      <section className="grid two-column quality-sections">
        <article className="card panel">
          <div className="panel-head">
            <h2>処理状態サマリー</h2>
            <CircleAlert size={18} aria-hidden="true" />
          </div>
          <div className="list">
            <div className="list-row">
              <span className="status-label">
                <CircleCheck size={16} aria-hidden="true" /> 処理済み
              </span>
              <span className="status success">{statuses.processed}件</span>
            </div>
            <div className="list-row">
              <span className="status-label">
                <CircleAlert size={16} aria-hidden="true" /> 要確認
              </span>
              <span className="status warning">{statuses.needsReview}件</span>
            </div>
            <div className="list-row">
              <span className="status-label">
                <CircleX size={16} aria-hidden="true" /> エラー
              </span>
              <span className="status danger">{statuses.error}件</span>
            </div>
          </div>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>該当データ一覧</h2>
            <Link2 size={18} aria-hidden="true" />
          </div>
          <div className="list">
            <Link className="list-row issue-link" href="/quality/issues?type=unconfirmed">
              <span>未確認データ一覧</span>
              <span className="status">開く</span>
            </Link>
            <Link className="list-row issue-link" href="/quality/issues?type=salesDepositGap">
              <span>売上と入金の差額一覧</span>
              <span className="status">開く</span>
            </Link>
            <Link className="list-row issue-link" href="/quality/issues?type=unmappedProduct">
              <span>商品マスター未登録一覧</span>
              <span className="status">開く</span>
            </Link>
            <Link className="list-row issue-link" href="/quality/issues?type=duplicateDate">
              <span>日付重複一覧</span>
              <span className="status">開く</span>
            </Link>
            <Link className="list-row issue-link" href="/quality/issues?type=mondayConflict">
              <span>月曜休業ルール矛盾一覧</span>
              <span className="status">開く</span>
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}

function MetricCard({
  title,
  value,
  note,
  href,
}: {
  title: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <article className="card metric-card">
      <div className="metric-label">
        <span>{title}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p className="metric-note">{note}</p>
      <Link className="metric-link" href={href}>
        該当データを確認する
      </Link>
    </article>
  );
}
