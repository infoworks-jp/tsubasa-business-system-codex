(function () {
  "use strict";

  window.TSUBASA_CONFIG = Object.freeze({
    supabaseUrl: "https://spyopczqtxypqjbhylzf.supabase.co",
    publishableKey: "sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg",
    schema: "rev2",
    publicUrl: "https://infoworks-jp.github.io/tsubasa-business-system-codex/"
  });

  // historical_daily_performance は 1,096 行あるため、Supabase REST の
  // 1回1,000行上限で2026年6〜8月が落ちないよう2ページ取得して結合する。
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.includes("/rest/v1/historical_daily_performance")) {
      return nativeFetch(input, init);
    }
    const baseInit = Object.assign({}, init || {});
    const baseHeaders = Object.assign({}, baseInit.headers || {});
    const fetchPage = async function(from, to) {
      const pageInit = Object.assign({}, baseInit, {
        headers: Object.assign({}, baseHeaders, { Range: from + "-" + to })
      });
      const res = await nativeFetch(input, pageInit);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };
    const first = await fetchPage(0, 999);
    const second = await fetchPage(1000, 1999);
    const merged = first.concat(second);
    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  function addExtraNav() {
    const nav = document.querySelector('header nav');
    if (!nav) return;
    if (!document.getElementById('historyNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'historyNavBtn';
      btn.textContent = '長期実績';
      btn.onclick = function () { location.href = './history.html'; };
      nav.appendChild(btn);
    }
    if (!document.getElementById('consultHistoryNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'consultHistoryNavBtn';
      btn.textContent = '長期コンサル分析';
      btn.onclick = function () { location.href = './consulting-history.html'; };
      nav.appendChild(btn);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addExtraNav);
  else addExtraNav();
})();
