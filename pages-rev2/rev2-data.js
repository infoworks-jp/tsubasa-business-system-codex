(function () {
  "use strict";

  const SUPABASE_URL = "https://spyopczqtxypqjbhylzf.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg";
  const TABLES = [
    "daily_journal", "journal_products", "journal_hours", "monthly_summary",
    "bank_transactions", "expenses", "payroll", "documents", "product_master"
  ];
  let cache;

  const number = (value) => value == null ? null : Number(value);
  const monthOf = (value) => String(value || "").slice(0, 7);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  async function select(table) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "Accept-Profile": "rev2"
      }
    });
    if (!response.ok) throw new Error(`${table}の取得に失敗しました（${response.status}）`);
    return response.json();
  }

  async function raw() {
    if (!cache) {
      cache = Promise.all(TABLES.map(select)).then((sets) =>
        Object.fromEntries(TABLES.map((table, index) => [table, sets[index]]))
      );
    }
    return cache;
  }

  function build(source) {
    const daily = source.daily_journal
      .filter((row) => row.status === "confirmed")
      .map((row) => ({
        ...row,
        total_sales: number(row.sales_total),
        customers: number(row.customer_count),
        avg_spend: row.customer_count ? number(row.sales_total) / number(row.customer_count) : null,
        issued_count: number(row.issued_count),
        settlement_count: number(row.settlement_count),
        settlement_amount: number(row.settlement_amount),
        net_count: number(row.net_count),
        lunch_sales: number(row.lunch_sales),
        evening_sales: number(row.evening_sales),
        late_sales: number(row.late_sales)
      }))
      .sort((a, b) => a.business_date.localeCompare(b.business_date));

    const months = [...new Set(daily.map((row) => monthOf(row.business_date)))].sort();
    const dailyById = new Map(daily.map((row) => [row.id, row]));
    const masterById = new Map(source.product_master.map((row) => [row.id, row]));

    const productRows = source.journal_products
      .filter((row) => row.source_scope === "monthly_confirmed")
      .map((row) => ({ ...row, quantity: number(row.quantity), sales_amount: number(row.sales_amount) }));
    const hourRows = source.journal_hours.map((row) => ({
      ...row,
      quantity: number(row.quantity),
      sales_amount: number(row.sales_amount)
    }));

    function inScope(value, scope) {
      return scope === "all" || monthOf(value) === scope;
    }

    function scopedDaily(scope) {
      return daily.filter((row) => inScope(row.business_date, scope));
    }

    function products(scope) {
      const map = new Map();
      for (const row of productRows.filter((item) => inScope(item.period_month, scope))) {
        const item = masterById.get(row.product_id) || {};
        const current = map.get(row.product_id) || {
          id: row.product_id,
          name: item.product_name || "商品未登録",
          category: item.category || "未分類",
          price: number(row.unit_price),
          issued_count: 0,
          settlement_count: 0,
          qty: 0,
          sales: 0
        };
        current.qty += row.quantity || 0;
        current.issued_count += number(row.issued_count) || row.quantity || 0;
        current.settlement_count += number(row.settlement_count) || 0;
        current.sales += row.sales_amount || 0;
        map.set(row.product_id, current);
      }
      const rows = [...map.values()].sort((a, b) => b.sales - a.sales);
      const total = rows.reduce((sum, row) => sum + row.sales, 0);
      return rows.map((row, index) => ({ ...row, rank: index + 1, share: total ? row.sales / total : null }));
    }

    function hourly(scope) {
      const map = new Map();
      for (const row of hourRows) {
        const journal = dailyById.get(row.daily_journal_id);
        if (!journal || !inScope(journal.business_date, scope)) continue;
        const current = map.get(row.hour_start) || { hour: row.hour_start, issued_count: 0, sales: 0 };
        current.issued_count += row.quantity || 0;
        current.sales += row.sales_amount || 0;
        map.set(row.hour_start, current);
      }
      return [...map.values()].sort((a, b) => a.hour - b.hour).map((row) => ({
        ...row,
        hour: `${String(row.hour).padStart(2, "0")}:00`,
        period: row.hour >= 11 && row.hour < 17 ? "昼" : row.hour >= 17 && row.hour < 22 ? "夜" : "深夜"
      }));
    }

    function monthly() {
      return months.map((month) => {
        const rows = scopedDaily(month);
        const operating = rows.filter((row) => row.total_sales > 0);
        const sales = rows.reduce((sum, row) => sum + row.total_sales, 0);
        const customers = rows.reduce((sum, row) => sum + (row.customers || 0), 0);
        return {
          month,
          sales,
          customers,
          days: operating.length,
          avg_daily: operating.length ? sales / operating.length : null,
          avg_spend: customers ? sales / customers : null
        };
      });
    }

    function overview(scope) {
      const all = scopedDaily("all");
      const rows = scopedDaily(scope);
      const operating = rows.filter((row) => row.total_sales > 0);
      const allOperating = all.filter((row) => row.total_sales > 0);
      const totalSales = all.reduce((sum, row) => sum + row.total_sales, 0);
      const totalCustomers = all.reduce((sum, row) => sum + (row.customers || 0), 0);
      const monthSales = rows.reduce((sum, row) => sum + row.total_sales, 0);
      const monthCustomers = rows.reduce((sum, row) => sum + (row.customers || 0), 0);
      return {
        month: scope,
        total_sales: totalSales,
        total_customers: totalCustomers,
        total_days: allOperating.length,
        month_sales: monthSales,
        month_customers: monthCustomers,
        month_days: operating.length,
        avg_daily: operating.length ? monthSales / operating.length : null,
        avg_spend: monthCustomers ? monthSales / monthCustomers : null,
        projection: null,
        month_count: months.length,
        avg_monthly: months.length ? totalSales / months.length : null,
        avg_customers_per_day: operating.length ? monthCustomers / operating.length : null
      };
    }

    function quality(scope) {
      const rows = scopedDaily(scope);
      const productList = products(scope);
      const hourList = hourly(scope);
      const dailyTotal = rows.reduce((sum, row) => sum + row.total_sales, 0);
      const productTotal = productList.reduce((sum, row) => sum + row.sales, 0);
      const hourTotal = hourList.reduce((sum, row) => sum + row.sales, 0);
      const productMonths = new Set(productRows.map((row) => monthOf(row.period_month)));
      const hourDays = new Set(hourRows.map((row) => row.daily_journal_id));
      const scopedHourDays = new Set(rows.filter((row) => hourDays.has(row.id)).map((row) => row.id));
      const hasDailyProducts = productRows.some((row) => row.daily_journal_id);
      const scopeMonths = scope === "all" ? months : [scope];
      const productComplete = scopeMonths.every((month) => productMonths.has(month));
      const details = rows.map((row) => {
        const product = productRows.filter((item) => item.daily_journal_id === row.id)
          .reduce((sum, item) => sum + item.sales_amount, 0);
        const hour = hourRows.filter((item) => item.daily_journal_id === row.id)
          .reduce((sum, item) => sum + item.sales_amount, 0);
        return {
          date: row.business_date,
          daily: row.total_sales,
          products: productComplete && hasDailyProducts ? product : null,
          product_diff: productComplete && hasDailyProducts ? row.total_sales - product : null,
          product_match: productComplete && hasDailyProducts && row.total_sales === product,
          hourly_gross: hourDays.has(row.id) ? hour : null,
          settlement_adjustment: row.settlement_amount,
          hourly_net: hourDays.has(row.id) ? hour + (row.settlement_amount || 0) : null,
          hourly_match: hourDays.has(row.id) && hour + (row.settlement_amount || 0) === row.total_sales
        };
      });
      const hourlyComparable = rows.length > 0 && rows.every((row) => hourDays.has(row.id));
      return {
        daily: dailyTotal,
        products: productComplete ? productTotal : null,
        hourly: hourList.length ? hourTotal : null,
        settlement_adjustment: rows.reduce((sum, row) => sum + (row.settlement_amount || 0), 0),
        hourly_net: hourList.length ? hourTotal + rows.reduce((sum, row) => sum + (row.settlement_amount || 0), 0) : null,
        product_match: productComplete && dailyTotal === productTotal,
        hourly_match: hourlyComparable && details.every((row) => row.hourly_match),
        matched: productComplete && dailyTotal === productTotal && hourlyComparable && details.every((row) => row.hourly_match),
        holidays: rows.filter((row) => row.total_sales === 0 && /休/.test(row.notes || "")).length,
        pending: rows.filter((row) => row.total_sales === 0 && !/休/.test(row.notes || "")).length,
        missing_product_dates: productComplete ? [] : ["商品別原本未登録"],
        source_scope: {
          product: productComplete ? "月全体" : "原本未登録",
          hourly: scopedHourDays.size ? `${scopedHourDays.size}営業日分` : "原本未登録"
        },
        details
      };
    }

    function bank(scope) {
      return source.bank_transactions.filter((row) => inScope(row.transaction_date, scope)).map((row) => ({
        deposit_date: row.transaction_date,
        sales_date: row.matched_sales_date || "",
        amount: number(row.deposit_amount),
        daily_sales: null,
        result: row.match_status === "matched" ? "一致" : "要確認",
        breakdown: row.description || "",
        source: row.source_reference || ""
      }));
    }

    return { months, monthly, overview, scopedDaily, products, hourly, quality, bank, source };
  }

  let aggregate;
  async function data() {
    if (!aggregate) aggregate = raw().then(build);
    return aggregate;
  }

  window.rev2Api = async function rev2Api(url) {
    const value = await data();
    if (url === "/api/bootstrap") {
      return { months: value.months, active_month: value.months.at(-1), overview: value.overview(value.months.at(-1)) };
    }
    if (url === "/api/monthly") return clone(value.monthly());
    if (url === "/api/expenses") {
      return clone(value.source.expenses.filter((row) => row.is_canonical !== false).map((row) => ({
        date: row.expense_date,
        category: row.category,
        amount: number(row.amount),
        description: row.description || "",
        status: row.status
      })));
    }
    if (url === "/api/payroll") return clone(value.source.payroll.map((row) => ({
      year_month: monthOf(row.payroll_month),
      monthly_sales: number(row.monthly_sales),
      employee_gross: number(row.employee_gross),
      parttime_gross: number(row.parttime_gross),
      salary_paid: number(row.gross_pay),
      labor_cost_rate: number(row.labor_cost_rate),
      sales_minus_labor: number(row.sales_minus_labor),
      status: row.status
    })));
    const match = url.match(/^\/api\/(overview|daily|products|hourly|bank|quality)\/(all|\d{4}-\d{2})$/);
    if (!match) throw new Error(`未対応のデータ参照: ${url}`);
    const [, kind, scope] = match;
    if (kind === "overview") return clone(value.overview(scope));
    if (kind === "daily") return clone(value.scopedDaily(scope));
    if (kind === "products") return clone(value.products(scope));
    if (kind === "hourly") return { rows: clone(value.hourly(scope)), source_scope: value.quality(scope).source_scope.hourly };
    if (kind === "bank") return clone(value.bank(scope));
    return clone(value.quality(scope));
  };
})();
