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
    if (!url.includes("/rest/v1/historical_daily_performance")) return nativeFetch(input, init);
    const baseInit = Object.assign({}, init || {});
    const baseHeaders = Object.assign({}, baseInit.headers || {});
    const fetchPage = async function(from, to) {
      const pageInit = Object.assign({}, baseInit, { headers: Object.assign({}, baseHeaders, { Range: from + "-" + to }) });
      const res = await nativeFetch(input, pageInit);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    };
    const first = await fetchPage(0, 999);
    const second = await fetchPage(1000, 1999);
    return new Response(JSON.stringify(first.concat(second)), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  function yen(v){ return '¥' + Math.round(Number(v||0)).toLocaleString(); }
  function iframePage(src, title, note){
    const host=document.getElementById('host');
    host.innerHTML=`<div class="panel"><h2 style="margin-top:0">${title}</h2><div class="notice ok" style="margin-bottom:10px">${note}</div><iframe src="${src}" style="width:100%;height:1200px;border:1px solid #d9e2f3;border-radius:10px;background:#fff" loading="lazy"></iframe></div>`;
  }

  async function fetchHistorical(){
    const c=window.TSUBASA_CONFIG;
    const u=c.supabaseUrl+'/rest/v1/historical_daily_performance?select=business_date,sales,source_month&order=business_date.asc';
    const r=await window.fetch(u,{headers:{apikey:c.publishableKey,'Accept-Profile':'rev2'}});
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function renderExecutive(){
    const host=document.getElementById('host');
    host.innerHTML='<div class="panel">社長向け画面を読み込み中...</div>';
    try{
      const api=window.rev2Api;
      const [boot,hist]=await Promise.all([api('/api/bootstrap'),fetchHistorical()]);
      const active=boot.active_month;
      const [ov,q,hourly]=await Promise.all([api('/api/overview/'+active),api('/api/quality/'+active),api('/api/hourly/'+active)]);
      const hm={}; hist.forEach(x=>{const z=hm[x.source_month]||(hm[x.source_month]={sales:0,days:0});z.sales+=Number(x.sales);z.days++});
      const m=active.slice(5), years=['2023','2024','2025','2026'];
      const same=years.map(y=>({year:y,v:hm[y+'-'+m]?.sales||null}));
      const nowIndex=same.findIndex(x=>x.year==='2026');
      const prev=same.find(x=>x.year==='2025')?.v||null;
      const currentSame=same[nowIndex]?.v||null;
      const yoy=(currentSame&&prev)?(currentSame/prev-1):null;
      const recentSummer=['06','07','08'].map(mm=>({month:mm,v:hm['2026-'+mm]?.sales||null,p:hm['2025-'+mm]?.sales||null}));
      const hr=(hourly&&hourly.rows)||[]; const byHour={}; hr.forEach(x=>{const h=Number(x.hour_start); const z=byHour[h]||(byHour[h]={s:0,n:0}); z.s+=Number(x.sales_amount||x.gross_sales||0); z.n++;});
      const topHours=Object.entries(byHour).sort((a,b)=>b[1].s-a[1].s).slice(0,3).map(x=>x[0]+'時').join('・')||'未集計';
      const dataIssues=[];
      dataIssues.push('長期の客数・客単価は全月そろっていないため、3年間の「客数減か単価低下か」の完全判定はまだできない');
      dataIssues.push('シフトは端末内保存（localStorage）なので、別端末・別担当者と自動共有されない');
      if(!q.matched) dataIssues.push('今月データに未照合・欠損があるため、確定値として扱えない項目がある');
      const sameHtml=same.map(x=>`<tr><td>${x.year}年${Number(m)}月</td><td>${x.v==null?'データなし':yen(x.v)}</td></tr>`).join('');
      const summerHtml=recentSummer.map(x=>`<tr><td>2026年${Number(x.month)}月</td><td>${x.v==null?'—':yen(x.v)}</td><td>${x.p==null?'—':yen(x.p)}</td><td>${x.v&&x.p?((x.v/x.p-1)*100).toFixed(1)+'%':'—'}</td></tr>`).join('');
      host.innerHTML=`
      <div class="panel" style="border-left:7px solid #17365d"><h2 style="margin:0 0 8px">社長が最初に見る画面</h2><div class="sub">結論 → 数字 → 原因 → 今やること、の順だけで読めます。</div></div>
      <div class="cards" style="margin-top:10px">
        <div class="card"><div class="label">${active.replace('-','年')}月 売上</div><div class="big">${yen(ov.month_sales)}</div><div class="sub">現在登録済み分</div></div>
        <div class="card"><div class="label">平均日商</div><div class="big">${yen(ov.avg_daily)}</div><div class="sub">売上÷営業日数</div></div>
        <div class="card"><div class="label">客単価</div><div class="big">${yen(ov.avg_spend)}</div><div class="sub">売上÷客数</div></div>
        <div class="card"><div class="label">データ状態</div><div class="big">${q.status}</div><div class="sub">${q.matched?'照合済み':'要確認あり'}</div></div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel"><h2>① まず結論</h2>
          <div class="insight"><b>店は売れなくなったのではなく、売れる日と弱い日の差が大きい。</b><br>2026年9月は27万円台の日が複数あり、需要は残っている。問題はピークの再現と弱い時間の人件費効率。</div>
          <div class="insight"><b>長期では2024年の高水準から2025〜2026年に低下。</b><br>市場要因だけではなく、集客・価格・商品・営業時間・人員配置を分解して見る必要がある。</div>
          <div class="insight"><b>今月の強い時間帯候補：</b> ${topHours}</div>
        </div>
        <div class="panel"><h2>② 社長判断に必要な不足情報</h2>${dataIssues.map(x=>`<div class="notice" style="margin:7px 0">${x}</div>`).join('')}<div class="sub">ここが埋まれば、初見の社長でも売上低下の原因を「客数・単価・人件費・商品・時間帯」に分けて判断できます。</div></div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel"><h2>③ 同月の年比較</h2><table><thead><tr><th>年</th><th>売上</th></tr></thead><tbody>${sameHtml}</tbody></table>${yoy==null?'':`<div class="insight"><b>2026年 vs 2025年：</b> ${yoy>=0?'+':''}${(yoy*100).toFixed(1)}%</div>`}</div>
        <div class="panel"><h2>④ 2026年 夏3か月</h2><table><thead><tr><th>月</th><th>2026</th><th>2025</th><th>前年比</th></tr></thead><tbody>${summerHtml}</tbody></table></div>
      </div>
      <div class="panel" style="margin-top:12px"><h2>⑤ 社長ならこの順にやる</h2>
        <div class="insight"><b>最優先：</b> 20〜23時に人員集中。2時台の売上が弱い日が多いため、深夜1時間の営業価値を継続検証。</div>
        <div class="insight"><b>次：</b> 値上げは一律ではなく、基本ラーメン・トッピング・セットの整合性を保つ。つばさラーメン2,000円は看板価格として据え置き候補。</div>
        <div class="insight"><b>次：</b> 商品ABCで低回転メニューを整理し、券売機を簡単にする。</div>
        <div class="insight"><b>次：</b> Google・多言語・写真・店頭で観光客の取りこぼしを減らす。</div>
        <div class="insight"><b>毎月：</b> 「売上」ではなく、客数・客単価・平均日商・人件費率・時間帯・商品構成を同じ順番で見る。</div>
      </div>`;
    }catch(e){host.innerHTML='<div class="panel notice ng">社長トップの読込に失敗しました。再読込してください。<br>'+String(e.message||e)+'</div>';}
  }

  function integrate(){
    const tabs=document.querySelector('.tabs');
    const nav=document.querySelector('header nav');
    if(nav){
      nav.innerHTML='<button onclick="showTab(\'executive\')">社長トップ</button><button onclick="showTab(\'overview\')">通常ダッシュボード</button><button onclick="showTab(\'historyAll\')">長期実績</button><button onclick="showTab(\'consultAll\')">長期コンサル</button><button onclick="showTab(\'shiftAll\')">シフト</button>';
    }
    if(tabs){
      const lead=document.createElement('div');
      lead.style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px';
      lead.innerHTML='<button id="t_executive" style="background:#17365d;color:#fff" onclick="showTab(\'executive\')">社長トップ</button><button id="t_historyAll" onclick="showTab(\'historyAll\')">長期比較</button><button id="t_consultAll" onclick="showTab(\'consultAll\')">コンサル判断</button><button id="t_shiftAll" onclick="showTab(\'shiftAll\')">シフト作成</button>';
      tabs.parentNode.insertBefore(lead,tabs);
      const note=document.createElement('div'); note.className='notice ok'; note.style='margin-bottom:10px'; note.innerHTML='<b>見方：</b> まず「社長トップ」だけ見れば全体像が分かります。必要な時だけ長期比較・コンサル・シフトへ進みます。';
      tabs.parentNode.insertBefore(note,tabs);
    }
    if(typeof window.showTab==='function'){
      const original=window.showTab;
      window.showTab=async function(tab){
        document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
        document.querySelectorAll('[id^="t_"]').forEach(x=>x.classList.remove('active'));
        const b=document.getElementById('t_'+tab); if(b)b.classList.add('active');
        if(tab==='executive') return renderExecutive();
        if(tab==='historyAll') return iframePage('./history.html','長期実績・4年比較','月・日別・同月比較・売上順ソートをここで確認します。別ページへ移動しません。');
        if(tab==='consultAll') return iframePage('./consulting-history.html','長期コンサル分析','社会情勢・インバウンド・経営批評・やるべきことをここで確認します。');
        if(tab==='shiftAll') return iframePage('./shift/','シフト作成','植山＝夜メイン、中山＝昼＋夜ヘルプ、東出＝夜不可。バイト時間・深夜割増を含む簡易シフトをこの画面内で作成します。');
        return original(tab);
      };
      setTimeout(()=>window.showTab('executive'),1200);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',integrate); else integrate();
})();
