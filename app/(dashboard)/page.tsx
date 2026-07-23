import {
  Archive,
  CircleAlert,
  DatabaseBackup,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const metrics = [
  {
    label: "最新営業日売上",
    value: "データ未登録",
    note: "実データ接続後に表示",
    icon: TrendingUp,
  },
  {
    label: "今月累計",
    value: "データ未登録",
    note: "確定状態を併記予定",
    icon: Archive,
  },
  {
    label: "品質スコア",
    value: "計算式未確定",
    note: "推測値は表示しません",
    icon: ShieldCheck,
  },
  {
    label: "要確認・未照合",
    value: "データ未登録",
    note: "実件数のみ表示",
    icon: CircleAlert,
  },
];

export default function HomePage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Manager overview</p>
          <h1>経営者ホーム</h1>
          <p className="lead">
            現在は画面構成の雛形です。売上データや計算処理は接続していません。
          </p>
        </div>
        <span className="badge">Phase 1 基盤構築中</span>
      </header>

      <section className="grid metrics" aria-label="主要指標">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <article className="card metric-card" key={label}>
            <div className="metric-label">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{value}</div>
            <p className="metric-note">{note}</p>
          </article>
        ))}
      </section>

      <section className="grid two-column">
        <article className="card panel">
          <div className="panel-head">
            <h2>商品ランキング TOP5</h2>
            <span className="status">未接続</span>
          </div>
          <div className="empty-state">
            商品別明細の実装後に、承認済みの集計定義で表示します。
          </div>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>運用ステータス</h2>
            <DatabaseBackup size={18} aria-hidden="true" />
          </div>
          <div className="list">
            <div className="list-row">
              <span>月間目標達成率</span>
              <span className="status warning">目標未登録</span>
            </div>
            <div className="list-row">
              <span>ビール販売</span>
              <span className="status warning">商品分類未確認</span>
            </div>
            <div className="list-row">
              <span>最後のバックアップ成功日時</span>
              <span className="status">未実行</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
