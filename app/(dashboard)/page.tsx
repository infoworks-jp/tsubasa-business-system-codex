import {
  Archive,
  CircleAlert,
  DatabaseBackup,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type QueueRow = {
  queue_status: "new" | "confirmed" | "needs-review" | "error" | "archived";
  needs_review_count: number;
  archived_at?: string | null;
};

type SalesRow = {
  business_date: string;
  product_id: string;
  quantity: number;
  amount: number;
};

type ProductRow = {
  id: string;
  product_name: string;
};

type DashboardData = {
  latestBusinessDayLabel: string;
  latestSalesValue: string;
  monthlySalesValue: string;
  queueNeedsReviewValue: string;
  queueStatusSummary: {
    newCount: number;
    confirmedCount: number;
    needsReviewCount: number;
    errorCount: number;
  };
  topProducts: Array<{
    productName: string;
    quantity: number;
    amount: number;
  }>;
  unavailable: boolean;
};

function toYen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function currentMonthPrefix() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function loadDashboardData(): Promise<DashboardData> {
  try {
    const client = getSupabaseServerClient();
    const monthPrefix = currentMonthPrefix();

    const [{ data: importsData, error: importsError }, { data: salesData, error: salesError }, { data: productsData, error: productsError }] = await Promise.all([
      client
        .from("ticket_ocr_imports")
        .select("queue_status, needs_review_count, archived_at")
        .is("archived_at", null),
      client.from("confirmed_product_sales_totals").select("business_date, product_id, quantity, amount"),
      client.from("products").select("id, product_name"),
    ]);

    if (importsError) throw new Error(importsError.message);
    if (salesError) throw new Error(salesError.message);
    if (productsError) throw new Error(productsError.message);

    const imports = (importsData ?? []) as QueueRow[];
    const sales = (salesData ?? []) as SalesRow[];
    const products = (productsData ?? []) as ProductRow[];

    const byDate = new Map<string, number>();
    let monthlyTotal = 0;
    const byProduct = new Map<string, { quantity: number; amount: number }>();

    for (const row of sales) {
      const date = String(row.business_date);
      const amount = Number(row.amount ?? 0);
      const quantity = Number(row.quantity ?? 0);

      byDate.set(date, (byDate.get(date) ?? 0) + amount);
      if (date.startsWith(monthPrefix)) {
        monthlyTotal += amount;
      }

      const current = byProduct.get(row.product_id) ?? { quantity: 0, amount: 0 };
      current.quantity += quantity;
      current.amount += amount;
      byProduct.set(row.product_id, current);
    }

    const latestBusinessDay = [...byDate.keys()].sort().at(-1) ?? null;
    const latestSales = latestBusinessDay ? byDate.get(latestBusinessDay) ?? 0 : 0;

    const productNameMap = new Map(products.map((row) => [row.id, row.product_name]));
    const topProducts = [...byProduct.entries()]
      .map(([productId, total]) => ({
        productName: productNameMap.get(productId) ?? "要確認",
        quantity: total.quantity,
        amount: total.amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const queueStatusSummary = {
      newCount: imports.filter((row) => row.queue_status === "new").length,
      confirmedCount: imports.filter((row) => row.queue_status === "confirmed").length,
        needsReviewCount: imports.filter((row) => row.queue_status === "needs-review").length,
      errorCount: imports.filter((row) => row.queue_status === "error").length,
    };

    const needsReviewCount = imports.reduce((acc, row) => acc + Number(row.needs_review_count ?? 0), 0);

    return {
      latestBusinessDayLabel: latestBusinessDay ?? "未登録",
      latestSalesValue: latestBusinessDay ? toYen(latestSales) : "データ未登録",
      monthlySalesValue: sales.length > 0 ? toYen(monthlyTotal) : "データ未登録",
      queueNeedsReviewValue: `${needsReviewCount}件`,
      queueStatusSummary,
      topProducts,
      unavailable: false,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return {
        latestBusinessDayLabel: "未接続",
        latestSalesValue: "データ未登録",
        monthlySalesValue: "データ未登録",
        queueNeedsReviewValue: "データ未登録",
        queueStatusSummary: {
          newCount: 0,
          confirmedCount: 0,
          needsReviewCount: 0,
          errorCount: 0,
        },
        topProducts: [],
        unavailable: true,
      };
    }

    return {
      latestBusinessDayLabel: "取得失敗",
      latestSalesValue: "取得失敗",
      monthlySalesValue: "取得失敗",
      queueNeedsReviewValue: "取得失敗",
      queueStatusSummary: {
        newCount: 0,
        confirmedCount: 0,
        needsReviewCount: 0,
        errorCount: 0,
      },
      topProducts: [],
      unavailable: true,
    };
  }
}

export default async function HomePage() {
  const dashboard = await loadDashboardData();
  const metrics = [
    {
      label: "最新営業日売上",
      value: dashboard.latestSalesValue,
      note: `営業日 ${dashboard.latestBusinessDayLabel}`,
      icon: TrendingUp,
    },
    {
      label: "今月累計",
      value: dashboard.monthlySalesValue,
      note: "保存済データの合計",
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
      value: dashboard.queueNeedsReviewValue,
      note: "Import Queueの要確認件数",
      icon: CircleAlert,
    },
  ];

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Manager overview</p>
          <h1>経営者ホーム</h1>
          <p className="lead">
            OCR取込から商品別集計までの保存結果を表示します。未確認データは要確認として停止します。
          </p>
        </div>
        <span className="badge">運用データ反映</span>
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
            <span className={`status ${dashboard.unavailable ? "warning" : "success"}`}>
              {dashboard.unavailable ? "未接続" : "反映中"}
            </span>
          </div>
          {dashboard.topProducts.length === 0 ? (
            <div className="empty-state">
              保存済データがありません。
            </div>
          ) : (
            <div className="list">
              {dashboard.topProducts.map((row) => (
                <div className="list-row" key={row.productName}>
                  <span>{row.productName}</span>
                  <span className="status">{toYen(row.amount)} / {row.quantity}食</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>運用ステータス</h2>
            <DatabaseBackup size={18} aria-hidden="true" />
          </div>
          <div className="list">
            <div className="list-row">
              <span>Import Queue 新規</span>
              <span className="status warning">{dashboard.queueStatusSummary.newCount}件</span>
            </div>
            <div className="list-row">
              <span>Import Queue 確認済</span>
              <span className="status warning">{dashboard.queueStatusSummary.confirmedCount}件</span>
            </div>
            <div className="list-row">
              <span>Import Queue 要確認</span>
              <span className="status warning">{dashboard.queueStatusSummary.needsReviewCount}件</span>
            </div>
            <div className="list-row">
              <span>Import Queue エラー</span>
              <span className="status danger">{dashboard.queueStatusSummary.errorCount}件</span>
            </div>
            <div className="list-row">
              <span>最後のバックアップ成功日時</span>
              <span className="status warning">未接続</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
