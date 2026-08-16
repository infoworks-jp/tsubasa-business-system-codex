// Tsubasa 3 enhancement loader: category drill-down + dashboard quick tabs + F/L / 2026-08-17
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

  const foodCategory = (category) => /食材|麺|餃子|イクラ|酒類|飲料/.test(String(category || ""));
  async function flRows() {
    const [expenses, payroll] = await Promise.all([window.rev2Api("/api/expenses"), window.rev2Api("/api/payroll")]);
    const byMonth = new Map((state.monthly || []).map(r => [r.month, { month:r.month, sales:+r.sales||0, food:0, labor:null, payrollStatus:"未登録" }]));
    expenses.forEach(r => {
      if (!foodCategory(r.category)) return;
      const m=String(r.date||"").slice(0,7); if(!byMonth.has(m)) return;
      byMonth.get(m).food += +r.amount||0;
    });
    payroll.forEach(r => {
      const x=byMonth.get(r.year_month); if(!x) return;
      const salary=+r.salary_paid||0, social=r.social_insurance==null?null:+r.social_insurance;
      x.labor=social==null?null:salary+social; x.payrollStatus=r.status||"未確定";
    });
    return [...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({
      ...x, fRate:x.sales?x.food/x.sales:null, lRate:x.sales&&x.labor!=null?x.labor/x.sales:null,
      flRate:x.sales&&x.labor!=null?(x.food+x.labor)/x.sales:null, flTotal:x.labor==null?null:x.food+x.labor
    }));
  }
  function rateText(v){return v==null?"未確定":(v*100).toFixed(1)+"%"}
  function flTrendSvg(rows){
    const data=rows.filter(r=>r.sales); const W=900,H=300,L=55,R=20,T=30,B=48,max=Math.max(70,...data.flatMap(r=>[r.fRate||0,r.lRate||0,r.flRate||0]).map(v=>v*100));
    const step=(W-L-R)/Math.max(1,data.length-1), y=v=>H-B-(v/max)*(H-T-B), pts=k=>data.map((r,i)=>`${L+i*step},${y((r[k]||0)*100)}`).join(" ");
    let s=`<svg viewBox="0 0 ${W} ${H}" aria-label="F/L月別推移">`;
    for(let i=0;i<=4;i++){const v=max*(1-i/4), yy=T+i*(H-T-B)/4;s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#dbe3ef"/><text x="${L-7}" y="${yy+4}" text-anchor="end" font-size="11">${v.toFixed(0)}%</text>`}
    [["fRate","#5b9bd5"],["lRate","#70ad47"],["flRate","#ed7d31"]].forEach(([k,c])=>{s+=`<polyline fill="none" stroke="${c}" stroke-width="3" points="${pts(k)}"/>`});
    data.forEach((r,i)=>{const x=L+i*step;s+=`<text x="${x}" y="${H-20}" text-anchor="middle" font-size="11">${r.month.slice(5)}月</text>`});
    return s+"</svg>";
  }
  async function installFLDashboard(){
    const rows=await flRows(); if(!rows.length) return;
    const target=state.scope==='all'?rows:rows.filter(r=>r.month===state.month); const sales=target.reduce((s,r)=>s+r.sales,0), food=target.reduce((s,r)=>s+r.food,0);
    const laborKnown=target.every(r=>r.labor!=null), labor=laborKnown?target.reduce((s,r)=>s+r.labor,0):null;
    const f=sales?food/sales:null,l=sales&&labor!=null?labor/sales:null,fl=sales&&labor!=null?(food+labor)/sales:null;
    const cards=document.getElementById("cards"); if(cards){cards.querySelectorAll(".flCard").forEach(n=>n.remove());[["F 原価率",rateText(f),yen(food)],["L 人件費率",rateText(l),labor==null?"社会保険未確定":yen(labor)],["F/L 比率",rateText(fl),labor==null?"未確定":yen(food+labor)]].forEach(a=>cards.insertAdjacentHTML("beforeend",`<div class="card flCard"><div class="label">${a[0]}</div><div class="big">${a[1]}</div><div class="sub">${a[2]}</div></div>`));}
    if(state.tab==='overview'){
      document.getElementById("flTrendPanel")?.remove();
      const tableRows=rows.map(r=>[ymLabel(r.month),yen(r.sales),yen(r.food),rateText(r.fRate),r.labor==null?'未確定':yen(r.labor),rateText(r.lRate),rateText(r.flRate)]);
      document.getElementById("host")?.insertAdjacentHTML("afterbegin",`<div id="flTrendPanel" class="panel" style="margin-bottom:12px"><h3>F/L 月別推移・累計</h3><div class="chartMeta">F＝食材・麺・餃子・イクラ・酒類・飲料仕入　L＝給与総支給＋事業主負担社会保険</div>${flTrendSvg(rows)}<div class="legend"><span><i class="dot" style="background:#5b9bd5"></i>F率</span><span><i class="dot" style="background:#70ad47"></i>L率</span><span><i class="dot" style="background:#ed7d31"></i>F/L率</span></div><div class="scroll" style="margin-top:10px">${table(["月","売上","F原価","F率","L人件費","L率","F/L率"],tableRows,true)}</div><div class="notice ${laborKnown?'ok':''}" style="margin-top:10px"><b>表示範囲累計</b>　売上 ${yen(sales)} ／ F ${yen(food)}（${rateText(f)}）／ L ${labor==null?'未確定':yen(labor)+'（'+rateText(l)+'）'} ／ F/L ${rateText(fl)}</div></div>`);
    }
  }

  function installCategoryEnhancements() {
    installDashboardQuickTabs();
    const categoryOf = function detailCategoryEnhanced(name, base) { const n=String(name||""); if(/つばさラーメン/.test(n))return"つばさラーメン";if(/チャーハン/.test(n))return"ご飯・チャーハン";if(/ビール|コーラ|ジュース|酒|ハイボール|サワー/.test(n))return"飲料";if(/セット/.test(n))return"セット";if(/味噌/.test(n))return"ラーメン・味噌";if(/醤油/.test(n))return"ラーメン・醤油";if(/塩/.test(n))return"ラーメン・塩";if(/餃子/.test(n))return"サイド・餃子";if(/ご飯|ライス|丼/.test(n))return"ご飯・丼・ライス";if(/チャーシュー|メンマ|ネギ|ねぎ|玉子|たまご|バター|コーン/.test(n))return"追加・トッピング";return base||"その他"; };
    window.detailCategory=categoryOf;
    if(typeof window.renderOverview==="function"&&!window.renderOverview.__flEnhanced){const prev=window.renderOverview;window.renderOverview=function(){prev();setTimeout(installFLDashboard,0)};window.renderOverview.__flEnhanced=true;}
    if(typeof window.renderCards==="function"&&!window.renderCards.__flEnhanced){const prev=window.renderCards;window.renderCards=function(d){prev(d);setTimeout(installFLDashboard,0)};window.renderCards.__flEnhanced=true;}
    const style=document.createElement("style");style.textContent=`#t_procurement_detail,#t_weekday_daypart{font-weight:800}.flCard .big{font-size:25px}#flTrendPanel svg{width:100%;height:auto;display:block}`;document.head.appendChild(style);
    if(typeof window.reloadCurrent==="function")window.reloadCurrent();
  }
  loadBase().then(installCategoryEnhancements).catch(error=>console.error("つばさ3拡張の読み込みに失敗しました",error));
})();