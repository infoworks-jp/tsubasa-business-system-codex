(function () {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const TABLE_ORDER = Object.freeze({
    historical_daily_performance: "business_date.asc",
    historical_monthly_performance: "month_start.asc",
    daily_journal: "business_date.asc",
    monthly_summary: "month_start.asc",
    payroll: "payroll_month.asc"
  });
  window.fetch = function patchedFetch(input, init) {
    try {
      const requestUrl = typeof input === "string" ? input : input && input.url;
      if (requestUrl && requestUrl.includes("spyopczqtxypqjbhylzf.supabase.co/rest/v1/")) {
        const url = new URL(requestUrl);
        const table = url.pathname.split("/rest/v1/")[1]?.split("/")[0];
        if (!url.searchParams.has("order")) url.searchParams.set("order", TABLE_ORDER[table] || "id.asc");
        const nextInit = Object.assign({}, init || {}, { cache: "no-store" });
        nextInit.headers = Object.assign({}, (init && init.headers) || {}, {
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        });
        if (typeof input === "string") return nativeFetch(url.toString(), nextInit);
        return nativeFetch(new Request(url.toString(), input), nextInit);
      }
    } catch (error) {
      console.warn("fresh-supabase patch fallback", error);
    }
    return nativeFetch(input, init);
  };

  window.__TSUBASA_FRESH_SUPABASE__ = true;

  // Load the read-only sales explorer without changing the existing dashboard,
  // historical tables, FL calculations, or underlying accounting records.
  const explorerUrl = new URL("./sales-trends.js?v=20261005-sales-v1", document.currentScript.src).href;
  function loadSalesExplorer() {
    if (!document.getElementById("host") || document.getElementById("sales-trends-module")) return;
    const script = document.createElement("script");
    script.id = "sales-trends-module";
    script.src = explorerUrl;
    script.onerror = function () {
      const note = document.createElement("div");
      note.className = "notice";
      note.textContent = "月別・年別売上グラフを読み込めませんでした。ページを再読み込みしてください。既存画面は引き続き利用できます。";
      document.querySelector("main")?.prepend(note);
    };
    document.body.appendChild(script);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadSalesExplorer, { once: true });
  else loadSalesExplorer();
})();
