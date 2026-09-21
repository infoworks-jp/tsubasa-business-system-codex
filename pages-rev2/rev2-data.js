(function () {
  "use strict";

  const config = window.TSUBASA_CONFIG;
  if (!config) throw new Error("site-config.js が読み込まれていません");
  const SUPABASE_URL = config.supabaseUrl;
  const PUBLISHABLE_KEY = config.publishableKey;
  const TABLES = [
    "daily_journal", "journal_products", "journal_hours", "monthly_summary",
    "bank_transactions", "expenses", "payroll", "documents", "product_master",
    "historical_monthly_performance", "monthly_operating_costs"
  ];
  let cache;

  const number = (value) => value == null ? null : Number(value);
  const monthOf = (value) => String(value || "").slice(0, 7);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  async function select(table) {
    const rows = [];
    const pageSize = 100;
    for (let start = 0; ; start += pageSize) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
          "Accept-Profile": config.schema,
          "Range-Unit": "items",
          Range: `${start}-${start + pageSize - 1}`
        }
      });
      if (!response.ok) throw new Error(`${table}の取得に失敗しました（${response.status}）`);
      const page = await response.json();
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async function raw() {
    if (!cache) {
      cache = Promise.all(TABLES.map(select)).then((sets) =>
        Object.fromEntries(TABLES.map((table, index) => [table, sets[index]]))
      ).catch((error) => {
        cache = undefined;
        throw error;
      });
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

    const dailyProductRows = source.journal_products
      .filter((row) => row.daily_journal_id)
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
      for (const row of dailyProductRows) {
        const journal = dailyById.get(row.daily_journal_id);
        if (!journal || !inScope(journal.business_date, scope)) continue;
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
        period: row.hour >= 10 && row.hour <= 17 ? "昼" : row.hour >= 18 && row.hour <= 23 ? "夜" : row.hour <= 2 ? "深夜" : "その他"
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
          avg_spend: customers ? sales / customers : null,
          status: quality(month).status
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
      const dailyTotal = rows.reduce((sum, row) => sum + row.total_sales, 0);
      const operatingRows = rows.filter((row) => row.total_sales > 0);
      const documentsByDate = new Map();
      for (const document of source.documents.filter((item) => item.business_date)) {
        const current = documentsByDate.get(document.business_date) || [];
        current.push(document);
        documentsByDate.set(document.business_date, current);
      }
      const details = rows.map((row) => {
        const productsForDay = dailyProductRows.filter((item) => item.daily_journal_id === row.id);
        const product = productsForDay
          .reduce((sum, item) => sum + item.sales_amount, 0);
        const hoursForDay = hourRows.filter((item) => item.daily_journal_id === row.id);
        const hour = hoursForDay
          .reduce((sum, item) => sum + item.sales_amount, 0);
        const hourQuantity = hoursForDay.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const documentsForDay = documentsByDate.get(row.business_date) || [];
        const hasDocument = documentsForDay.some((item) =>
          /journal|券売機|日計|verified_master_source|検算済み正本|管理マスター/i.test(
            `${item.document_type || ""} ${item.file_name || ""}`
          )
        );
        const hasRetainedDocument = documentsForDay.some((item) =>
          item.retention_status === "preserved" &&
          /^[0-9a-f]{64}$/.test(String(item.sha256 || "")) &&
          Number(item.byte_size) > 0 &&
          Boolean(item.archive_uri || item.library_file_id)
        );
        const productComparable = row.total_sales > 0 && productsForDay.length === 40;
        const hourlyComparable = row.total_sales > 0 && hoursForDay.length === 24;
        return {
          date: row.business_date,
          daily: row.total_sales,
          products: productComparable ? product : null,
          product_diff: productComparable ? row.total_sales - product : null,
          product_match: productComparable && row.total_sales === product,
          product_rows: productsForDay.length,
          hourly_gross: hourlyComparable ? hour : null,
          settlement_adjustment: row.settlement_amount,
          hourly_net: null,
          hourly_difference: hourlyComparable ? hour - row.total_sales : null,
          hourly_large_difference: hourlyComparable
            ? Math.abs(hour - row.total_sales) >= Math.max(5000, row.total_sales * 0.05)
            : false,
          hourly_rows: hoursForDay.length,
          hourly_quantity: hourlyComparable ? hourQuantity : null,
          hourly_match: hourlyComparable && hoursForDay.length === 24,
          document_match: row.total_sales > 0 && hasDocument,
          retained_document_match: row.total_sales > 0 && hasRetainedDocument
        };
      });
      const operatingDetails = details.filter((row) => row.daily > 0);
      const productComplete = operatingDetails.length > 0 && operatingDetails.every((row) => row.product_match);
      const hourlyComplete = operatingDetails.length > 0 && operatingDetails.every((row) => row.hourly_match);
      const hourlyAnomalyDates = operatingDetails.filter((row) => row.hourly_large_difference).map((row) => row.date);
      const hourlySafe = hourlyComplete && hourlyAnomalyDates.length === 0;
      const documentComplete = operatingDetails.length > 0 && operatingDetails.every((row) => row.document_match);
      const retentionComplete = operatingDetails.length > 0 && operatingDetails.every((row) => row.retained_document_match);
      const productTotal = productComplete
        ? operatingDetails.reduce((sum, row) => sum + row.products, 0)
        : null;
      const scopedHourDays = operatingDetails.filter((row) => row.hourly_rows === 24).length;
      const completeHourlyDetails = operatingDetails.filter((row) => row.hourly_rows === 24);
      const hourTotal = completeHourlyDetails.reduce((sum, row) => sum + row.hourly_gross, 0);
      const scopedSettlementAdjustment = completeHourlyDetails
        .reduce((sum, row) => sum + (row.settlement_adjustment || 0), 0);
      const pending = rows.filter((row) => row.total_sales === 0 && !/休/.test(row.notes || "")).length;
      const absentProductDates = operatingDetails.filter((row) => row.product_rows === 0).map((row) => row.date);
      const productMismatchDates = operatingDetails.filter((row) => row.product_rows > 0 && !row.product_match).map((row) => row.date);
      const missingProductDates = absentProductDates.concat(productMismatchDates);
      const absentHourlyDates = operatingDetails.filter((row) => row.hourly_rows === 0).map((row) => row.date);
      const hourlyMismatchDates = operatingDetails.filter((row) => row.hourly_rows > 0 && !row.hourly_match).map((row) => row.date);
      const missingHourlyDates = absentHourlyDates.concat(hourlyMismatchDates);
      const missingDocumentDates = operatingDetails.filter((row) => !row.document_match).map((row) => row.date);
      const missingRetainedSourceDates = operatingDetails.filter((row) => !row.retained_document_match).map((row) => row.date);
      const matched = productComplete && hourlySafe && documentComplete && retentionComplete && pending === 0;
      const productRegisteredDays = operatingDetails.filter((row) => row.product_rows > 0).length;
      const registeredProductTotal = operatingDetails
        .filter((row) => row.product_rows > 0 && row.products !== null)
        .reduce((sum, row) => sum + row.products, 0);
      const productBreakdownPendingTotal = Math.max(0, dailyTotal - registeredProductTotal);
      const hourlyRegisteredDays = operatingDetails.filter((row) => row.hourly_rows > 0).length;
      const statusFor = (registered, expected, complete) => {
        if (registered === 0) return "unregistered";
        if (complete && registered === expected) return "complete";
        return "partial";
      };
      return {
        daily: dailyTotal,
        products: productTotal,
        registered_product_total: productRegisteredDays ? registeredProductTotal : null,
        product_breakdown_pending_total: productBreakdownPendingTotal,
        hourly: scopedHourDays ? hourTotal : null,
        settlement_adjustment: scopedHourDays ? scopedSettlementAdjustment : null,
        hourly_net: scopedHourDays ? hourTotal - scopedSettlementAdjustment : null,
        product_match: productComplete,
        hourly_match: hourlyComplete,
        document_match: documentComplete,
        retained_document_match: retentionComplete,
        matched,
        status: matched ? "確定" : "要確認",
        holidays: rows.filter((row) => row.total_sales === 0 && /休/.test(row.notes || "")).length,
        pending,
        missing_product_dates: missingProductDates,
        missing_hourly_dates: missingHourlyDates,
        hourly_anomaly_dates: hourlyAnomalyDates,
        absent_product_dates: absentProductDates,
        product_mismatch_dates: productMismatchDates,
        absent_hourly_dates: absentHourlyDates,
        hourly_mismatch_dates: hourlyMismatchDates,
        missing_document_dates: missingDocumentDates,
        missing_retained_source_dates: missingRetainedSourceDates,
        coverage: {
          operating_days: operatingDetails.length,
          product_days: productRegisteredDays,
          hourly_days: hourlyRegisteredDays,
          product_status: statusFor(productRegisteredDays, operatingDetails.length, productComplete),
          hourly_status: statusFor(hourlyRegisteredDays, operatingDetails.length, hourlyComplete)
        },
        source_scope: {
          product: productRegisteredDays === 0 ? "未登録" : (productComplete ? `${operatingRows.length}営業日分` : `${productRegisteredDays}/${operatingRows.length}営業日分`),
          hourly: hourlyRegisteredDays === 0 ? "原本未登録" : `${hourlyRegisteredDays}/${operatingRows.length}営業日分`,
          document: documentComplete ? `${operatingRows.length}営業日分` : `${operatingRows.length - missingDocumentDates.length}/${operatingRows.length}営業日分`,
          retained_original: `${operatingRows.length - missingRetainedSourceDates.length}/${operatingRows.length}営業日分`
        },
        details
      };
    }

    function salesDate(row) {
      const match = String(row.handwritten_note || "").match(/(\d{1,2})\/(\d{1,2})\s*売上/);
      if (!match) return null;
      const transaction = new Date(`${row.transaction_date}T00:00:00Z`);
      let year = transaction.getUTCFullYear();
      const month = Number(match[1]);
      if (month > transaction.getUTCMonth() + 2) year -= 1;
      return `${year}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
    }

    function bank(scope) {
      const dailyByDate = new Map(daily.map((row) => [row.business_date, row]));
      const groups = new Map();
      const unresolved = [];
      const bankDeposits = source.bank_transactions.filter((row) =>
        number(row.deposit_amount) > 0 && /売上入金/.test(row.estimated_category || "")
      );
      const exactSalesDates = new Set(bankDeposits.filter((row) => {
        const journal = dailyByDate.get(row.transaction_date);
        return journal && journal.total_sales === (number(row.deposit_amount) || 0);
      }).map((row) => row.transaction_date));
      for (const row of bankDeposits) {
        const depositAmount = number(row.deposit_amount) || 0;
        const sameDayJournal = dailyByDate.get(row.transaction_date);
        const exactSameDay = sameDayJournal && sameDayJournal.total_sales === depositAmount;
        const notedDate = salesDate(row);
        if (!exactSameDay && notedDate && exactSalesDates.has(notedDate)) {
          if (inScope(row.transaction_date, scope)) unresolved.push({
            deposit_date: row.transaction_date,
            sales_date: "",
            amount: depositAmount,
            daily_sales: null,
            difference: null,
            result: "売上日要確認",
            breakdown: row.handwritten_note || row.description || "",
            source: row.source_reference || ""
          });
          continue;
        }
        const date = exactSameDay
          ? row.transaction_date
          : notedDate;
        if (!date || !months.includes(monthOf(date)) || !inScope(date, scope)) continue;
        const current = groups.get(date) || { sales_date: date, amount: 0, deposits: [], notes: [], sources: [] };
        current.amount += depositAmount;
        current.deposits.push(row.transaction_date);
        current.notes.push(row.handwritten_note || row.description || "");
        current.sources.push(row.source_reference || "");
        groups.set(date, current);
      }
      const matchedRows = [...groups.values()].sort((a, b) => a.sales_date.localeCompare(b.sales_date)).map((row) => {
        const journal = dailyByDate.get(row.sales_date);
        const expected = journal ? journal.total_sales : null;
        const diff = expected == null ? null : row.amount - expected;
        return {
          deposit_date: [...new Set(row.deposits)].join("、"),
          sales_date: row.sales_date,
          amount: row.amount,
          daily_sales: expected,
          difference: diff,
          result: expected == null ? "日別未登録" : diff === 0 ? "一致" : `差額 ${diff > 0 ? "+" : ""}${diff.toLocaleString("ja-JP")}円`,
          breakdown: row.notes.join("＋"),
          source: [...new Set(row.sources)].join("、")
        };
      });
      return [...matchedRows, ...unresolved].sort((a, b) =>
        `${a.sales_date || a.deposit_date}`.localeCompare(`${b.sales_date || b.deposit_date}`)
      );
    }

    return { months, monthly, overview, scopedDaily, products, hourly, quality, bank, source };
  }

  let aggregate;
  async function data() {
    if (!aggregate) {
      aggregate = raw().then(build).catch((error) => {
        aggregate = undefined;
        throw error;
      });
    }
    return aggregate;
  }

  window.rev2Api = async function rev2Api(url) {
    if (url === "/api/fl-refresh") {cache = undefined; aggregate = undefined; return true;}
    const value = await data();
    const insurance = row => window.TsubasaFLModel.reconcileInsurance(monthOf(row.payroll_month),
      row.social_insurance_reconciliation, value.source.bank_transactions,
      value.source.payroll.map(r => r.social_insurance_reconciliation));
    if (url === "/api/bootstrap") {
      const months = [...new Set([...value.months, ...value.source.payroll.map(r => monthOf(r.payroll_month))])].sort();
      return { months, active_month: value.months.at(-1), overview: value.overview(value.months.at(-1)) };
    }
    if (url === "/api/fl-inputs") return clone({
      payroll: value.source.payroll.map(r => ({
        month: monthOf(r.payroll_month), employee: number(r.employee_gross),
        parttime: number(r.parttime_gross), salary: number(r.gross_pay),
        employer: insurance(r).employer, insurance: insurance(r), totalEmployer: null,
        employerRecorded: number(r.social_insurance_reconciliation ? r.social_insurance_reconciliation.legacy_recorded_payment : r.employer_cost),
        corrected: String(r.status).includes('重複修正済み')
      })),
      insuranceEvents: value.source.bank_transactions.filter(r =>
        /社保料返金|労働保険/.test(r.handwritten_note || '')).map(r => ({
          date:r.transaction_date, amount:number(r.deposit_amount)>0?number(r.deposit_amount):number(r.withdrawal_amount),
          kind:number(r.deposit_amount)>0?'社会保険返金':'労働保険納付',source:r.source_reference,
          status:'対象期間・会社負担への配分未確認。月次Lへ未算入。'
        })),
      historical: value.source.historical_monthly_performance.map(r => ({
        month: monthOf(r.month_start), sales: number(r.sales_total),
        source: `${r.source_file} p${r.source_page}`, verified: r.verification_status === 'verified_from_original'
      })),
      ticket: value.source.monthly_summary.filter(r => r.is_canonical && r.status === 'confirmed').map(r => ({
        month: monthOf(r.month_start), sales: number(r.sales_total), source: r.source
      })),
      purchases: value.source.expenses.filter(r => r.is_canonical === true && r.status === 'confirmed'
        && /^invoice-/.test(r.source_key) && /^(麺仕入|餃子仕入|食材仕入|飲料仕入|酒類仕入)$/.test(r.category))
        .map(r => ({key: r.source_key, month: monthOf(r.expense_date), amount: number(r.amount), source: r.source_reference})),
      rent: value.source.monthly_operating_costs.filter(r => r.cost_type === 'rent' && r.verification_status === 'confirmed')
        .map(r => ({month: monthOf(r.month_start), amount: number(r.amount)}))
    });
    if (url === "/api/monthly") return clone(value.monthly());
    if (url === "/api/historical-monthly") {
      return clone(value.source.historical_monthly_performance
        .map((row) => ({
          month: monthOf(row.month_start),
          sales: number(row.sales_total),
          customers: number(row.customer_count),
          avg_spend: number(row.average_spend),
          source_page: number(row.source_page),
          source_file: row.source_file,
          verification_status: row.verification_status,
          series: "長期原票系列"
        }))
        .sort((a, b) => a.month.localeCompare(b.month)));
    }
    if (url === "/api/operating-costs") {
      return clone(value.source.monthly_operating_costs.map((row) => ({
        month: monthOf(row.month_start),
        type: row.cost_type,
        vendor: row.vendor,
        amount: number(row.amount),
        status: row.verification_status,
        source: row.source_reference,
        notes: row.notes
      })));
    }
    if (url === "/api/expenses") {
      return clone(value.source.bank_transactions.filter((row) => number(row.withdrawal_amount) > 0).map((row) => ({
        date: row.transaction_date,
        category: row.estimated_category || "未分類",
        amount: number(row.withdrawal_amount),
        description: row.handwritten_note || row.description || "",
        status: row.match_status === "matched" ? "確認済み" : "要確認",
        source: row.source_reference || ""
      })));
    }
    if (url === "/api/payroll") return clone(value.source.payroll.map((row) => ({
      year_month: monthOf(row.payroll_month),
      monthly_sales: number(row.monthly_sales),
      employee_gross: number(row.employee_gross),
      parttime_gross: number(row.parttime_gross),
      salary_paid: number(row.gross_pay),
      social_insurance: insurance(row).employer,
      social_insurance_basis: '納付総額−従業員の社会保険・厚生年金控除（調整前・労働保険別）',
      salary_plus_social: insurance(row).employer==null?null:number(row.gross_pay)+insurance(row).employer,
      insurance_reconciliation: insurance(row),
      unverified_social_payment: insurance(row).employer==null?number(row.social_insurance_reconciliation?.legacy_recorded_payment ?? row.employer_cost):null,
      total_labor: null,
      total_labor_rate: null,
      labor_cost_rate: number(row.labor_cost_rate),
      sales_minus_labor: number(row.sales_minus_labor),
      sales_minus_total_labor: null,
      status: '給与支給額と社会保険差引額を分離。返金・労働保険の配分は未確認。売上系列は月により異なるためFL・改善推移で比較してください。'
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
