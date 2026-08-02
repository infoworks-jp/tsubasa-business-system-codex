import { getSupabaseServerClient } from "@/lib/supabase/server";

export type Rev2Analytics = Awaited<ReturnType<typeof getRev2Analytics>>;

type Daily = { id: string; business_date: string; sales_total: number; customer_count: number | null; status: string };
type Product = { daily_journal_id: string; product_id: string; quantity: number; unit_price: number; sales_amount: number; product_master: { product_code: string; product_name: string; category: string } | null };
type Hour = { daily_journal_id: string; hour_start: number; quantity: number; sales_amount: number };
type Bank = { id: string; transaction_date: string; deposit_amount: number; withdrawal_amount: number; match_status: string };
type Expense = { expense_date: string; category: string; amount: number };
type Payroll = { payroll_month: string; gross_pay: number; employer_cost: number };

const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

function monthKey(value: string) {
  return value.slice(0, 7);
}

export async function getRev2Analytics() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const [dailyResult, productResult, hourResult, bankResult, expenseResult, payrollResult, documentResult] = await Promise.all([
    supabase.schema("rev2").from("daily_journal").select("id,business_date,sales_total,customer_count,status").order("business_date"),
    supabase.schema("rev2").from("journal_products").select("daily_journal_id,product_id,quantity,unit_price,sales_amount,product_master(product_code,product_name,category)"),
    supabase.schema("rev2").from("journal_hours").select("daily_journal_id,hour_start,quantity,sales_amount"),
    supabase.schema("rev2").from("bank_transactions").select("id,transaction_date,deposit_amount,withdrawal_amount,match_status").order("transaction_date"),
    supabase.schema("rev2").from("expenses").select("expense_date,category,amount").order("expense_date"),
    supabase.schema("rev2").from("payroll").select("payroll_month,gross_pay,employer_cost").order("payroll_month"),
    supabase.schema("rev2").from("documents").select("id,ocr_status")
  ]);

  const errors = [dailyResult, productResult, hourResult, bankResult, expenseResult, payrollResult, documentResult]
    .map((result) => result.error)
    .filter(Boolean);
  if (errors.length) throw new Error(errors.map((error) => error?.message).join("; "));

  const daily = (dailyResult.data ?? []) as Daily[];
  const products = (productResult.data ?? []) as unknown as Product[];
  const hours = (hourResult.data ?? []) as Hour[];
  const bank = (bankResult.data ?? []) as Bank[];
  const expenses = (expenseResult.data ?? []) as Expense[];
  const payroll = (payrollResult.data ?? []) as Payroll[];
  const documents = documentResult.data ?? [];

  const dailyById = new Map(daily.map((row) => [row.id, row]));
  const productTotals = new Map<string, { productCode: string; productName: string; category: string; quantity: number; sales: number }>();
  for (const row of products) {
    const key = row.product_id;
    const current = productTotals.get(key) ?? {
      productCode: row.product_master?.product_code ?? "未登録",
      productName: row.product_master?.product_name ?? "商品未登録",
      category: row.product_master?.category ?? "未分類",
      quantity: 0,
      sales: 0
    };
    current.quantity += row.quantity;
    current.sales += row.sales_amount;
    productTotals.set(key, current);
  }

  const productRanking = [...productTotals.values()].sort((a, b) => b.sales - a.sales);
  const allProductSales = productRanking.reduce((sum, row) => sum + row.sales, 0);
  let cumulative = 0;
  const abc = productRanking.map((row) => {
    cumulative += row.sales;
    const cumulativeShare = allProductSales === 0 ? null : cumulative / allProductSales;
    const abcClass = cumulativeShare === null ? "評価不能" : cumulativeShare <= 0.7 ? "A" : cumulativeShare <= 0.9 ? "B" : "C";
    return { ...row, cumulativeShare, abcClass };
  });

  const weekday = weekdayNames.map((name) => ({ name, sales: 0, businessDays: 0 }));
  for (const row of daily) {
    const day = new Date(row.business_date + "T00:00:00Z").getUTCDay();
    weekday[day].sales += row.sales_total;
    weekday[day].businessDays += 1;
  }

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, quantity: 0, sales: 0 }));
  for (const row of hours) {
    hourly[row.hour_start].quantity += row.quantity;
    hourly[row.hour_start].sales += row.sales_amount;
  }

  const monthlyMap = new Map<string, { month: string; sales: number; businessDays: number; customers: number; productSales: number; hourSales: number; expenses: number; payroll: number }>();
  for (const row of daily) {
    const key = monthKey(row.business_date);
    const current = monthlyMap.get(key) ?? { month: key, sales: 0, businessDays: 0, customers: 0, productSales: 0, hourSales: 0, expenses: 0, payroll: 0 };
    current.sales += row.sales_total;
    current.businessDays += 1;
    current.customers += row.customer_count ?? 0;
    monthlyMap.set(key, current);
  }
  for (const row of products) {
    const source = dailyById.get(row.daily_journal_id);
    if (source) monthlyMap.get(monthKey(source.business_date))!.productSales += row.sales_amount;
  }
  for (const row of hours) {
    const source = dailyById.get(row.daily_journal_id);
    if (source) monthlyMap.get(monthKey(source.business_date))!.hourSales += row.sales_amount;
  }
  for (const row of expenses) {
    const key = monthKey(row.expense_date);
    const current = monthlyMap.get(key) ?? { month: key, sales: 0, businessDays: 0, customers: 0, productSales: 0, hourSales: 0, expenses: 0, payroll: 0 };
    current.expenses += row.amount;
    monthlyMap.set(key, current);
  }
  for (const row of payroll) {
    const key = monthKey(row.payroll_month);
    const current = monthlyMap.get(key) ?? { month: key, sales: 0, businessDays: 0, customers: 0, productSales: 0, hourSales: 0, expenses: 0, payroll: 0 };
    current.payroll += row.employer_cost;
    monthlyMap.set(key, current);
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const productByDay = new Map<string, number>();
  for (const row of products) productByDay.set(row.daily_journal_id, (productByDay.get(row.daily_journal_id) ?? 0) + row.sales_amount);
  const hourByDay = new Map<string, number>();
  for (const row of hours) hourByDay.set(row.daily_journal_id, (hourByDay.get(row.daily_journal_id) ?? 0) + row.sales_amount);

  const duplicateProductKeys = new Set<string>();
  const seenProducts = new Set<string>();
  for (const row of products) {
    const key = [row.daily_journal_id, row.product_id, row.unit_price].join(":");
    if (seenProducts.has(key)) duplicateProductKeys.add(key);
    seenProducts.add(key);
  }

  const qaDays = daily.map((row) => {
    const productSales = productByDay.get(row.id) ?? 0;
    const hourSales = hourByDay.get(row.id) ?? 0;
    return {
      businessDate: row.business_date,
      dailySales: row.sales_total,
      productSales,
      hourSales,
      dailyMatchesProduct: row.sales_total === productSales,
      dailyMatchesHour: row.sales_total === hourSales,
      productMatchesHour: productSales === hourSales
    };
  });
  const failedOcr = documents.filter((row) => row.ocr_status === "failed").length;
  const qaFailures =
    qaDays.filter((row) => !row.dailyMatchesProduct || !row.dailyMatchesHour || !row.productMatchesHour).length +
    duplicateProductKeys.size +
    failedOcr;

  const salesTotal = daily.reduce((sum, row) => sum + row.sales_total, 0);
  const customerCount = daily.reduce((sum, row) => sum + (row.customer_count ?? 0), 0);
  const unmatchedBank = bank.filter((row) => row.match_status !== "matched").length;

  return {
    generatedAt: new Date().toISOString(),
    kpi: {
      salesTotal,
      businessDays: daily.length,
      customerCount,
      averageSpend: customerCount === 0 ? null : salesTotal / customerCount,
      unmatchedBank,
      qaFailures
    },
    products: productRanking,
    abc,
    weekday,
    hourly,
    monthly,
    bank,
    quality: {
      days: qaDays,
      duplicateProducts: duplicateProductKeys.size,
      failedOcr,
      unmatchedBank,
      failures: qaFailures
    },
    consulting: {
      strongestProduct: productRanking[0] ?? null,
      strongestWeekday: [...weekday].filter((row) => row.businessDays > 0).sort((a, b) => b.sales / b.businessDays - a.sales / a.businessDays)[0] ?? null,
      strongestHour: [...hourly].sort((a, b) => b.sales - a.sales)[0] ?? null,
      latestMonth: monthly.at(-1) ?? null
    }
  };
}
