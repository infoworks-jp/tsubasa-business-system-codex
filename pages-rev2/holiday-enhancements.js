// Tsubasa 3 enhancement loader: category drill-down / 2026-08-10
(function () {
  "use strict";

  function loadBase() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./holiday-enhancements-base.js?v=20260810-category-drilldown";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function installCategoryEnhancements() {
    const categoryOf = function detailCategoryEnhanced(name, base) {
      const n = String(name || "");
      if (/つばさラーメン/.test(n)) return "つばさラーメン";
      if (/チャーハン/.test(n)) return "ご飯・チャーハン";
      if (/ビール|コーラ|ジュース|酒|ハイボール|サワー/.test(n)) return "飲料";
      if (/セット/.test(n)) return "セット";
      if (/味噌/.test(n)) return "ラーメン・味噌";
      if (/醤油/.test(n)) return "ラーメン・醤油";
      if (/塩/.test(n)) return "ラーメン・塩";
      if (/餃子/.test(n)) return "サイド・餃子";
      if (/ご飯|ライス|丼/.test(n)) return "ご飯・丼・ライス";
      if (/チャーシュー|メンマ|ネギ|ねぎ|玉子|たまご|バター|コーン/.test(n)) return "追加・トッピング";
      return base || "その他";
    };
    window.detailCategory = categoryOf;

    function categoryDrilldownHtml() {
      const productTotal = state.products.reduce((sum, row) => sum + (+row.sales || 0), 0);
      const groups = new Map();
      state.products.forEach((row) => {
        const label = categoryOf(row.name, row.category);
        if (!groups.has(label)) groups.set(label, { label, sales: 0, qty: 0, items: [] });
        const group = groups.get(label);
        group.sales += +row.sales || 0;
        group.qty += +row.qty || 0;
        group.items.push(row);
      });
      const rows = [...groups.values()].sort((a, b) => b.sales - a.sales);
      return rows.map((group) => {
        group.items.sort((a, b) => (+b.sales || 0) - (+a.sales || 0));
        const share = productTotal ? group.sales / productTotal : 0;
        const itemRows = group.items.map((row) => {
          const itemShare = group.sales ? (+row.sales || 0) / group.sales : 0;
          return `<tr><td>${escapeHtml(row.name)}</td><td>${(+row.qty || 0).toLocaleString("ja-JP")}</td><td>${yen(row.sales)}</td><td>${pct(itemShare)}</td></tr>`;
        }).join("");
        return `<details class="categoryDrill"><summary><span class="categoryName">${escapeHtml(group.label)}</span><span class="categoryBar"><i style="width:${Math.max(1, share * 100)}%"></i></span><b>${yen(group.sales)}</b><span class="categoryShare">${pct(share)}</span><span class="categoryArrow">明細</span></summary><div class="categoryDetail"><div class="sub">出数 ${group.qty.toLocaleString("ja-JP")}　／　分類内 ${group.items.length}商品</div><div class="scroll"><table><thead><tr><th>商品</th><th>出数</th><th>売上</th><th>分類内構成比</th></tr></thead><tbody>${itemRows}</tbody></table></div></div></details>`;
      }).join("");
    }

    function replaceCategoryPanel() {
      const panels = [...document.querySelectorAll("#host .panel")];
      const panel = panels.find((node) => (node.querySelector("h3")?.textContent || "").includes("商品詳細分類別 売上構成"));
      if (!panel) return;
      panel.innerHTML = `<h3>${scopeLabel()} 商品詳細分類別 売上構成</h3><div class="chartMeta">分類名をクリックすると、その中の商品・出数・売上・分類内構成比を展開します。</div>${categoryDrilldownHtml()}`;
    }

    if (typeof window.renderOverview === "function" && !window.renderOverview.__categoryEnhanced) {
      const previousRenderOverview = window.renderOverview;
      const enhancedRenderOverview = function enhancedRenderOverview() {
        previousRenderOverview();
        replaceCategoryPanel();
      };
      enhancedRenderOverview.__holidayEnhanced = previousRenderOverview.__holidayEnhanced;
      enhancedRenderOverview.__categoryEnhanced = true;
      window.renderOverview = enhancedRenderOverview;
    }

    const style = document.createElement("style");
    style.textContent = `
      .categoryDrill{border:1px solid #d9e2f3;border-radius:8px;margin:8px 0;background:#fff;overflow:hidden}
      .categoryDrill summary{display:grid;grid-template-columns:minmax(145px,1.2fr) minmax(100px,1.5fr) 110px 62px 48px;gap:10px;align-items:center;padding:10px;cursor:pointer;list-style:none}
      .categoryDrill summary::-webkit-details-marker{display:none}
      .categoryDrill[open] summary{background:#f4f7fb}
      .categoryName{font-weight:700;color:#17365d}
      .categoryBar{height:14px;background:#e8eef8;border-radius:4px;overflow:hidden}.categoryBar i{display:block;height:100%;background:#5b9bd5}
      .categoryShare{text-align:right;font-size:12px;color:#475569}.categoryArrow{font-size:12px;color:#4472c4;text-align:right}
      .categoryDetail{padding:0 10px 10px}.categoryDetail .sub{margin-bottom:7px}
      @media(max-width:700px){.categoryDrill summary{grid-template-columns:1fr 90px 56px}.categoryBar{grid-column:1/-1;order:4}.categoryArrow{display:none}}
    `;
    document.head.appendChild(style);

    if (typeof window.reloadCurrent === "function") window.reloadCurrent();
  }

  loadBase().then(installCategoryEnhancements).catch((error) => {
    console.error("つばさ3拡張の読み込みに失敗しました", error);
  });
})();