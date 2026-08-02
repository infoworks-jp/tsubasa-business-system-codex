import type { Rev2Analytics } from "@/lib/rev2/analytics";

type View = "kpi" | "products" | "abc" | "weekday" | "hourly" | "monthly" | "consulting" | "quality" | "bank";
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP");

export function Rev2Dashboard({ view, data }: { view: View; data: Rev2Analytics }) {
  if (view === "kpi") return <section><h1>KPI</h1><p>更新: {data.generatedAt}</p><div className="metric-grid">
    <Metric label="売上" value={yen.format(data.kpi.salesTotal)} /><Metric label="営業日" value={`${number.format(data.kpi.businessDays)}日`} />
    <Metric label="客数" value={number.format(data.kpi.customerCount)} /><Metric label="客単価" value={data.kpi.averageSpend === null ? "評価不能" : yen.format(data.kpi.averageSpend)} />
    <Metric label="通帳未照合" value={`${number.format(data.kpi.unmatchedBank)}件`} /><Metric label="QA NG" value={`${number.format(data.kpi.qaFailures)}件`} />
  </div></section>;
  if (view === "products") return <Table title="商品別" headers={["商品コード","商品名","分類","数量","売上"]} rows={data.products.map((r) => [r.productCode,r.productName,r.category,number.format(r.quantity),yen.format(r.sales)])} />;
  if (view === "abc") return <Table title="ABC" headers={["商品","数量","売上","累計構成比","区分"]} rows={data.abc.map((r) => [r.productName,number.format(r.quantity),yen.format(r.sales),r.cumulativeShare === null ? "評価不能" : `${(r.cumulativeShare * 100).toFixed(1)}%`,r.abcClass])} />;
  if (view === "weekday") return <Table title="曜日" headers={["曜日","営業日","売上","1日平均"]} rows={data.weekday.map((r) => [r.name,number.format(r.businessDays),yen.format(r.sales),r.businessDays === 0 ? "評価不能" : yen.format(r.sales / r.businessDays)])} />;
  if (view === "hourly") return <Table title="時間帯" headers={["時間","数量","売上"]} rows={data.hourly.filter((r) => r.quantity || r.sales).map((r) => [`${r.hour}:00`,number.format(r.quantity),yen.format(r.sales)])} />;
  if (view === "monthly") return <Table title="月別" headers={["月","営業日","売上","商品計","時間帯計","経費","給与会社負担"]} rows={data.monthly.map((r) => [r.month,number.format(r.businessDays),yen.format(r.sales),yen.format(r.productSales),yen.format(r.hourSales),yen.format(r.expenses),yen.format(r.payroll)])} />;
  if (view === "bank") return <Table title="通帳" headers={["日付","入金","出金","照合"]} rows={data.bank.map((r) => [r.transaction_date,yen.format(r.deposit_amount),yen.format(r.withdrawal_amount),r.match_status])} />;
  if (view === "consulting") return <section><h1>経営コンサル</h1><div className="metric-grid">
    <Metric label="売上最大商品" value={data.consulting.strongestProduct?.productName ?? "評価不能"} /><Metric label="1日平均最大曜日" value={data.consulting.strongestWeekday?.name ?? "評価不能"} />
    <Metric label="売上最大時間帯" value={data.consulting.strongestHour ? `${data.consulting.strongestHour.hour}:00` : "評価不能"} /><Metric label="最新集計月" value={data.consulting.latestMonth?.month ?? "評価不能"} />
  </div><p>登録済みデータの最大値だけを表示しています。推測値や固定目標は使用していません。</p></section>;
  return <section><h1>品質検証</h1><div className="metric-grid"><Metric label="NG合計" value={`${data.quality.failures}件`} /><Metric label="商品重複" value={`${data.quality.duplicateProducts}件`} /><Metric label="OCR失敗" value={`${data.quality.failedOcr}件`} /><Metric label="通帳未照合" value={`${data.quality.unmatchedBank}件`} /></div>
    <Table title="日別一致" headers={["営業日","日別","商品別","時間帯","D=P","D=T","P=T"]} rows={data.quality.days.map((r) => [r.businessDate,yen.format(r.dailySales),yen.format(r.productSales),yen.format(r.hourSales),r.dailyMatchesProduct ? "OK" : "NG",r.dailyMatchesHour ? "OK" : "NG",r.productMatchesHour ? "OK" : "NG"])} /></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>; }
function Table({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <section><h1>{title}</h1><div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>データなし</td></tr>}</tbody></table></div></section>; }
