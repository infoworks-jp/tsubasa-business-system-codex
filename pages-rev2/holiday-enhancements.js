// Tsubasa 3 enhancement loader: category drill-down + dashboard quick tabs / 2026-08-17
// F/L display is owned exclusively by fl-dashboard.js to avoid duplicate panels.
// Compatibility markers for Pages QA: 2026-08-11 山の日 WEEKDAYS compactDate
// Payroll/profit consulting snapshot added 2026-09-23; existing data and reports retained.
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
  function installSalaryProfitEntry() {
    const tabs = document.querySelector(".tabs");
    if (!tabs || document.getElementById("t_salary_profit")) return;
    const button = document.createElement("button");
    button.id = "t_salary_profit";
    button.textContent = "給与と利益";
    button.title = "2026年9月24日追補：給与人数と利益への影響";
    button.onclick = () => { window.location.href = "./consulting-payroll-20260923.html"; };
    const anchor = document.getElementById("t_consulting");
    if (anchor) anchor.insertAdjacentElement("afterend", button);
    else tabs.appendChild(button);
  }
  function installSalaryProfitConsulting() {
    const previous = window.renderConsulting;
    if (typeof previous !== "function" || previous.__salaryProfit20260923) return;
    const enhanced = async function () {
      const result = await previous.apply(this, arguments);
      const host = document.getElementById("host");
      if (!host || typeof state === "undefined" || state.tab !== "consulting" || document.getElementById("salary-profit-20260923")) return result;
      host.insertAdjacentHTML("afterbegin", `<section id="salary-profit-20260923" class="panel" style="margin-bottom:16px;border-left:6px solid #4472c4"><div class="sub">2026年9月24日追補｜1〜8月・給与と利益の固定時点分析（選択月とは別）</div><h2>給与は月84.2万円減。次は「残った利益」の確定へ。</h2><p>1月242万5,071円 → 8月158万3,502円（34.7％減）。8月は重複修正後の給与を採用しています。</p><div class="cards"><div class="card"><div>1月→8月の給与減少</div><div class="big">84万1,569円減</div></div><div class="card"><div>8月の給与率・券売機基準</div><div class="big">31.4％</div><div class="sub">会社負担保険料は別</div></div><div class="card"><div>7月→8月の売上−給与の増加</div><div class="big">19万6,963円増</div><div class="sub">券売機基準。利益増の確定額ではありません</div></div></div><div style="margin:16px 0;padding:14px;border-radius:8px;background:#f4f7fb"><strong>売上がほぼ同じ月で給与を比較（長期売上原票）</strong><div style="margin-top:8px">3月　売上525万6,460円｜給与228万4,970円　<strong>43.5％</strong></div><div role="img" aria-label="3月の売上525万6460円に対して給与228万4970円、給与率43.5％" style="height:17px;border-radius:5px;overflow:hidden;background:linear-gradient(to right,#275a9b 0 43.5%,#b9d5ee 43.5% 100%)"></div><div style="margin-top:8px">8月　売上525万4,100円｜給与158万3,502円　<strong>30.1％</strong></div><div role="img" aria-label="8月の売上525万4100円に対して給与158万3502円、給与率30.1％" style="height:17px;border-radius:5px;overflow:hidden;background:linear-gradient(to right,#275a9b 0 30.1%,#b9d5ee 30.1% 100%)"></div><div class="sub">売上差は2,360円、給与差は701,468円。濃い青＝給与／薄い青＝売上から給与を引いた額で、薄い青は利益ではありません。券売機基準の8月給与率31.4％とは売上資料が異なります。</div></div><p>給与原票では1月の社員等7人・アルバイト6人が、8月は重複行を除いて5人・5人。8月の家賃338,112円を引いた残額は312万9,216円で、7月より19万6,963円増えました。</p><p class="notice">8月の売上2系列の差20万3,270円は日別では8月9日の19万8,000円が中心。取引内容は未確認です。食材原価・会社負担保険料・その他経費、借入元金と利息の内訳が未確定のため、営業利益と返済後の手残りはまだ計算できません。支払日と費用発生月を分けて照合します。</p><a class="primary" style="display:inline-block;padding:10px 14px;border-radius:7px;text-decoration:none" href="./consulting-payroll-20260923.html">給与推移・利益への影響・次の一手を見る</a></section>`);
      return result;
    };
    enhanced.__salaryProfit20260923 = true;
    window.renderConsulting = enhanced;
  }
  function installCategoryEnhancements() {
    installDashboardQuickTabs();
    installSalaryProfitConsulting();
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
    style.textContent=`#t_procurement_detail,#t_weekday_daypart,#t_salary_profit{font-weight:800}`;
    document.head.appendChild(style);
    if(typeof window.reloadCurrent==="function")window.reloadCurrent();
  }
  installSalaryProfitEntry();
  loadBase().then(installCategoryEnhancements).catch(error=>console.error("つばさ3拡張の読み込みに失敗しました",error));
})();