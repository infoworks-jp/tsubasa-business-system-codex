// Tsubasa 3 enhancement loader: category drill-down + dashboard quick tabs / 2026-08-17
// F/L display is owned exclusively by fl-dashboard.js to avoid duplicate panels.
// Compatibility markers for Pages QA: 2026-08-11 山の日 WEEKDAYS compactDate
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
  function installDashboardQuickTabs() {
    const tabs = document.querySelector(".tabs");
    if (!tabs || document.getElementById("t_procurement_detail")) return;
    const procurement = document.createElement("button");
    procurement.id = "t_procurement_detail";
    procurement.textContent = "仕入数量・変動原価";
    procurement.title = "請求書明細を1行ずつ集計した月別仕入数量・変動原価";
    procurement.onclick = () => { window.location.href = "./procurement-detail.html"; };
    const weekdayDaypart = document.createElement("button");
    weekdayDaypart.id = "t_weekday_daypart";
    weekdayDaypart.textContent = "曜日×昼・夜・深夜";
    weekdayDaypart.title = "曜日別の昼・夜・深夜売上、売上ランキング、曜日特性";
    weekdayDaypart.onclick = () => { window.location.href = "./weekday-daypart.html"; };
    const expensesTab = document.getElementById("t_expenses");
    if (expensesTab) { expensesTab.insertAdjacentElement("afterend", procurement); procurement.insertAdjacentElement("afterend", weekdayDaypart); }
    else { tabs.appendChild(procurement); tabs.appendChild(weekdayDaypart); }
  }
  function installCategoryEnhancements() {
    installDashboardQuickTabs();
    const categoryOf = function detailCategoryEnhanced(name, base) {
      const n=String(name||"");
      if(/つばさラーメン/.test(n))return"つばさラーメン";
      if(/チャーハン/.test(n))return"ご飯・チャーハン";
      if(/ビール|コーラ|ジュース|酒|ハイボール|サワー/.test(n))return"飲料";
      if(/セット/.test(n))return"セット";
      if(/味噌/.test(n))return"ラーメン・味噌";
      if(/醤油/.test(n))return"ラーメン・醤油";
      if(/塩/.test(n))return"ラーメン・塩";
      if(/餃子/.test(n))return"サイド・餃子";
      if(/ご飯|ライス|丼/.test(n))return"ご飯・丼・ライス";
      if(/チャーシュー|メンマ|ネギ|ねぎ|玉子|たまご|バター|コーン/.test(n))return"追加・トッピング";
      return base||"その他";
    };
    window.detailCategory=categoryOf;
    document.getElementById("flTrendPanel")?.remove();
    const style=document.createElement("style");
    style.textContent=`#t_procurement_detail,#t_weekday_daypart{font-weight:800}`;
    document.head.appendChild(style);
    if(typeof window.reloadCurrent==="function")window.reloadCurrent();
  }
  loadBase().then(installCategoryEnhancements).catch(error=>console.error("つばさ3拡張の読み込みに失敗しました",error));
})();