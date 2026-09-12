(function () {
  "use strict";

  window.TSUBASA_CONFIG = Object.freeze({
    supabaseUrl: "https://spyopczqtxypqjbhylzf.supabase.co",
    publishableKey: "sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg",
    schema: "rev2",
    publicUrl: "https://infoworks-jp.github.io/tsubasa-business-system-codex/"
  });

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/rest/v1/historical_daily_performance'))return nativeFetch(input,init);
    const baseInit=Object.assign({},init||{}),baseHeaders=Object.assign({},baseInit.headers||{});
    const fetchPage=async(from,to)=>{const pageInit=Object.assign({},baseInit,{headers:Object.assign({},baseHeaders,{Range:from+'-'+to})});const res=await nativeFetch(input,pageInit);if(!res.ok)throw new Error(await res.text());return res.json()};
    const first=await fetchPage(0,999),second=await fetchPage(1000,1999);
    return new Response(JSON.stringify(first.concat(second)),{status:200,headers:{'Content-Type':'application/json'}});
  };

  const HIST_CUSTOMERS={
    '2023-08':6437,'2023-09':5676,'2023-10':4718,'2023-11':3773,'2023-12':4184,
    '2024-02':5746,'2024-03':4676,'2024-04':2980,'2024-05':3906,'2024-06':6092,'2024-07':4612,'2024-08':5638,'2024-09':5114,'2024-10':4294,'2024-11':4074,'2024-12':4108,
    '2025-01':3723,'2025-02':4610,'2025-03':3651,'2025-04':2428,'2025-05':3544,'2025-06':4213,'2025-07':3726,'2025-08':4185,'2025-09':4367,'2025-10':3826,'2025-11':3345,'2025-12':3288,
    '2026-01':3009,'2026-02':4183,'2026-03':3286,'2026-04':2098,'2026-05':2631,'2026-06':3006,'2026-07':2767,'2026-08':3025
  };

  const yen=v=>'¥'+Math.round(Number(v||0)).toLocaleString();
  function iframePage(src,title,note){const host=document.getElementById('host');host.innerHTML=`<div class="panel"><h2 style="margin-top:0">${title}</h2><div class="notice ok" style="margin-bottom:10px">${note}</div><iframe src="${src}" style="width:100%;height:1250px;border:1px solid #d9e2f3;border-radius:10px;background:#fff" loading="lazy"></iframe></div>`}
  async function fetchHistorical(){const c=window.TSUBASA_CONFIG,u=c.supabaseUrl+'/rest/v1/historical_daily_performance?select=business_date,sales,source_month&order=business_date.asc';const r=await window.fetch(u,{headers:{apikey:c.publishableKey,'Accept-Profile':'rev2'}});if(!r.ok)throw new Error(await r.text());return r.json()}
  function histMonthly(hist){const hm={};hist.forEach(x=>{const z=hm[x.source_month]||(hm[x.source_month]={sales:0,days:0});z.sales+=Number(x.sales);z.days++});Object.keys(hm).forEach(k=>{hm[k].customers=HIST_CUSTOMERS[k]||null;hm[k].avg=hm[k].customers?hm[k].sales/hm[k].customers:null});return hm}

  async function renderExecutive(){
    const host=document.getElementById('host');host.innerHTML='<div class="panel">社長向け画面を読み込み中...</div>';
    try{
      const api=window.rev2Api,[boot,hist]=await Promise.all([api('/api/bootstrap'),fetchHistorical()]),active=boot.active_month;
      const [ov,q,hourly,products,daily]=await Promise.all([api('/api/overview/'+active),api('/api/quality/'+active),api('/api/hourly/'+active),api('/api/products/'+active),api('/api/daily/'+active)]);
      const hm=histMonthly(hist),m=active.slice(5),years=['2023','2024','2025','2026'],same=years.map(y=>({year:y,...(hm[y+'-'+m]||{})}));
      const recentSummer=['06','07','08'].map(mm=>({month:mm,n:hm['2026-'+mm],p:hm['2025-'+mm]}));
      const hr=(hourly&&hourly.rows)||[],byHour={};hr.forEach(x=>{const h=Number(x.hour_start),z=byHour[h]||(byHour[h]={s:0});z.s+=Number(x.sales_amount||x.gross_sales||0)});const topHours=Object.entries(byHour).sort((a,b)=>b[1].s-a[1].s).slice(0,3).map(x=>x[0]+'時').join('・')||'未集計';
      const pcount=Array.isArray(products)?products.length:0,dailyCount=(daily||[]).filter(x=>Number(x.total_sales||0)>0).length,hourlyDates=new Set(hr.map(x=>x.business_date).filter(Boolean)).size;
      const dataIssues=['長期原票には月別の客数が記載されています。客単価も「売上÷客数」で算出できます。月次比較へ反映しました。'];
      if(pcount===0)dataIssues.push(active+'の商品別明細は未登録です。商品グラフやビールを0円とは扱いません。「未登録」と表示します。');
      if(hr.length&&hourlyDates&&dailyCount&&hourlyDates<dailyCount)dataIssues.push('時間帯別は '+hourlyDates+'日分、日計は '+dailyCount+'営業日分。時間帯は一部未登録です。');
      if(!q.matched)dataIssues.push('「要確認」の主因は、商品別・時間帯別など内訳データの不足です。日計売上が欠損・ゼロという意味ではありません。');
      dataIssues.push('シフトは端末内保存（localStorage）のため、別端末とはまだ自動共有されません。');
      const sameHtml=same.map(x=>`<tr><td>${x.year}年${Number(m)}月</td><td>${x.sales==null?'データなし':yen(x.sales)}</td><td>${x.customers==null?'—':Number(x.customers).toLocaleString()+'人'}</td><td>${x.avg==null?'—':yen(x.avg)}</td></tr>`).join('');
      const summerHtml=recentSummer.map(x=>`<tr><td>${Number(x.month)}月</td><td>${x.n?yen(x.n.sales):'—'}</td><td>${x.n?.customers?x.n.customers.toLocaleString()+'人':'—'}</td><td>${x.n?.avg?yen(x.n.avg):'—'}</td><td>${x.p&&x.n?((x.n.sales/x.p.sales-1)*100).toFixed(1)+'%':'—'}</td></tr>`).join('');
      host.innerHTML=`<div class="panel" style="border-left:7px solid #17365d"><h2 style="margin:0 0 8px">社長が最初に見る画面</h2><div class="sub">結論 → 数字 → 原因 → 今やること、の順だけで読めます。</div></div>
      <div class="cards" style="margin-top:10px"><div class="card"><div class="label">${active.replace('-','年')}月 売上</div><div class="big">${yen(ov.month_sales)}</div><div class="sub">登録済み日計</div></div><div class="card"><div class="label">平均日商</div><div class="big">${yen(ov.avg_daily)}</div><div class="sub">売上÷営業日数</div></div><div class="card"><div class="label">客単価</div><div class="big">${yen(ov.avg_spend)}</div><div class="sub">売上÷客数</div></div><div class="card"><div class="label">データ状態</div><div class="big">${q.status}</div><div class="sub">${q.matched?'照合済み':'内訳に未登録あり'}</div></div></div>
      <div class="grid2" style="margin-top:12px"><div class="panel"><h2>① まず結論</h2><div class="insight"><b>9月は強い。</b><br>27万円台の日が複数あり、需要は残っています。課題はピークの再現と弱い時間帯の人件費効率です。</div><div class="insight"><b>長期では売上だけでなく客数と客単価も見ます。</b><br>原票の月次累計客数を反映し、客単価を計算できるようにしました。</div><div class="insight"><b>強い時間帯候補：</b> ${topHours}</div></div><div class="panel"><h2>② 今、何が未登録か</h2>${dataIssues.map(x=>`<div class="notice" style="margin:7px 0">${x}</div>`).join('')}</div></div>
      <div class="grid2" style="margin-top:12px"><div class="panel"><h2>③ 同月4年比較</h2><table><thead><tr><th>年</th><th>売上</th><th>客数</th><th>客単価</th></tr></thead><tbody>${sameHtml}</tbody></table></div><div class="panel"><h2>④ 2026年 夏3か月</h2><table><thead><tr><th>月</th><th>売上</th><th>客数</th><th>客単価</th><th>売上前年比</th></tr></thead><tbody>${summerHtml}</tbody></table></div></div>
      <div class="panel" style="margin-top:12px"><h2>⑤ 社長ならこの順にやる</h2><div class="insight"><b>1.</b> 20〜23時へ人員集中。深夜2時台は採算を毎月検証。</div><div class="insight"><b>2.</b> 9月の商品別データを入れて、売れている商品・ビール・低回転品を確定する。</div><div class="insight"><b>3.</b> 売上・客数・客単価を前年同月とセットで見る。</div><div class="insight"><b>4.</b> 値上げは基本ラーメンとトッピングの整合を崩さない。</div></div>`;
    }catch(e){host.innerHTML='<div class="panel notice ng">社長トップの読込に失敗しました。<br>'+String(e.message||e)+'</div>'}
  }

  function showNoProductData(tab){const title=tab==='beer'?'ビール・セット':tab==='abc'?'ABC分析':'商品別・全商品';document.getElementById('host').innerHTML=`<div class="panel"><h2>${title}</h2><div class="notice ng"><b>この月の商品別明細はまだ登録されていません。</b><br>空欄や0円は「売れていない」という意味ではありません。券売機の日計写真ではビール販売が確認できるため、ビールを0円扱いしません。商品別原票を登録後にグラフを出します。</div></div>`}

  function injectHistoryCustomerPanel(){if(!location.pathname.endsWith('/history.html'))return;setTimeout(async()=>{try{const hist=await fetchHistorical(),hm=histMonthly(hist),main=document.querySelector('main');if(!main||document.getElementById('histCustomerPanel'))return;const rows=Object.keys(hm).sort().map(k=>`<tr><td>${k}</td><td>${yen(hm[k].sales)}</td><td>${hm[k].customers?hm[k].customers.toLocaleString()+'人':'—'}</td><td>${hm[k].avg?yen(hm[k].avg):'—'}</td></tr>`).join('');const p=document.createElement('div');p.id='histCustomerPanel';p.className='panel';p.style='margin:11px 0';p.innerHTML=`<h2>月別 売上・客数・客単価（原票）</h2><div class="sub">37ページ原票の月末累計客数を使用。客単価＝月売上÷月客数。</div><div class="scroll"><table><thead><tr><th>月</th><th>売上</th><th>客数</th><th>客単価</th></tr></thead><tbody>${rows}</tbody></table></div>`;const toolbar=main.querySelector('.toolbar');toolbar?toolbar.after(p):main.prepend(p)}catch(e){console.error(e)}},900)}

  function integrate(){
    injectHistoryCustomerPanel();
    const tabs=document.querySelector('.tabs'),nav=document.querySelector('header nav');
    if(nav)nav.innerHTML='<button onclick="showTab(\'executive\')">社長トップ</button><button onclick="showTab(\'overview\')">通常ダッシュボード</button><button onclick="showTab(\'historyAll\')">長期実績</button><button onclick="showTab(\'consultAll\')">長期コンサル</button><button onclick="showTab(\'shiftAll\')">シフト</button>';
    if(tabs){const lead=document.createElement('div');lead.style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px';lead.innerHTML='<button id="t_executive" style="background:#17365d;color:#fff" onclick="showTab(\'executive\')">社長トップ</button><button id="t_historyAll" onclick="showTab(\'historyAll\')">長期比較</button><button id="t_consultAll" onclick="showTab(\'consultAll\')">コンサル判断</button><button id="t_shiftAll" onclick="showTab(\'shiftAll\')">シフト作成</button>';tabs.parentNode.insertBefore(lead,tabs);const note=document.createElement('div');note.className='notice ok';note.style='margin-bottom:10px';note.innerHTML='<b>見方：</b> 最初は「社長トップ」だけ見てください。必要な時だけ長期比較・商品・時間帯・シフトへ進みます。';tabs.parentNode.insertBefore(note,tabs)}
    if(typeof window.showTab==='function'){const original=window.showTab;window.showTab=async function(tab){document.querySelectorAll('[id^="t_"]').forEach(x=>x.classList.remove('active'));const b=document.getElementById('t_'+tab);if(b)b.classList.add('active');if(tab==='executive')return renderExecutive();if(tab==='historyAll')return iframePage('./history.html','長期実績・4年比較','売上だけでなく、原票の客数と計算客単価も表示します。');if(tab==='consultAll')return iframePage('./consulting-history.html','長期コンサル分析','社会情勢・インバウンド・経営批評・やるべきことを確認します。');if(tab==='shiftAll')return iframePage('./shift/','シフト作成','売上ピークと深夜割増を見ながら作成します。');if(['products','abc','beer'].includes(tab)&&state&&Array.isArray(state.products)&&state.products.length===0)return showNoProductData(tab);return original(tab)};setTimeout(()=>window.showTab('executive'),1200)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',integrate);else integrate();
})();