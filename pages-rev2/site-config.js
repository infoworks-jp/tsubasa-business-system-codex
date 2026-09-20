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
    const all=[];for(let from=0;;from+=1000){const page=await fetchPage(from,from+999);all.push(...page);if(page.length<1000)break}
    return new Response(JSON.stringify(all),{status:200,headers:{'Content-Type':'application/json','X-Tsubasa-Rows':String(all.length)}});
  };

  const yen=v=>'¥'+Math.round(Number(v||0)).toLocaleString();
  function iframePage(src,title,note){const host=document.getElementById('host');host.innerHTML=`<div class="panel"><h2 style="margin-top:0">${title}</h2><div class="notice ok" style="margin-bottom:10px">${note}</div><iframe src="${src}" style="width:100%;height:1250px;border:1px solid #d9e2f3;border-radius:10px;background:#fff" loading="lazy"></iframe></div>`}
  async function fetchHistorical(){const c=window.TSUBASA_CONFIG,u=c.supabaseUrl+'/rest/v1/historical_daily_performance?select=business_date,sales,source_month&order=business_date.asc';const r=await window.fetch(u,{headers:{apikey:c.publishableKey,'Accept-Profile':'rev2'}});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function fetchHistoricalMonthly(){const c=window.TSUBASA_CONFIG,u=c.supabaseUrl+'/rest/v1/historical_monthly_performance?select=month_start,sales_total,customer_count,average_spend,source_page,verification_status&order=month_start.asc';const r=await nativeFetch(u,{headers:{apikey:c.publishableKey,'Accept-Profile':'rev2'},cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function fetchTicketDaily(){const c=window.TSUBASA_CONFIG,u=c.supabaseUrl+'/rest/v1/daily_journal?select=business_date,sales_total,customer_count,status&status=eq.confirmed&order=business_date.asc';const r=await nativeFetch(u,{headers:{apikey:c.publishableKey,'Accept-Profile':'rev2'},cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
  function histMonthly(rows){const hm={};rows.forEach(x=>{const k=String(x.month_start).slice(0,7);hm[k]={sales:Number(x.sales_total),customers:Number(x.customer_count),avg:Number(x.average_spend),source_page:Number(x.source_page),series:'長期原票系列'}});return hm}

  let executiveVersion=0;
  async function renderExecutive(){
    const version=++executiveVersion,scope=currentScope();
    const host=document.getElementById('host');host.innerHTML='<div class="panel">みんな向け画面を読み込み中...</div>';
    try{
      const api=window.rev2Api,[boot,histRows,ticketRows]=await Promise.all([api('/api/bootstrap'),api('/api/historical-monthly'),api('/api/monthly')]),active=scope==='all'?'all':state.month;
      const [ov,q,hourly,daily]=await Promise.all([api('/api/overview/'+active),api('/api/quality/'+active),api('/api/hourly/'+active),api('/api/daily/'+active)]);
      const hm=histMonthly(histRows.map(x=>({month_start:x.month,sales_total:x.sales,customer_count:x.customers,average_spend:x.avg_spend,source_page:x.source_page}))),ticket=Object.fromEntries(ticketRows.map(x=>[x.month,x])),m=(active==='all'?boot.active_month:active).slice(5),years=['2023','2024','2025','2026'],same=years.map(y=>({year:y,...(hm[y+'-'+m]||{})}));
      const recentSummer=['06','07','08'].map(mm=>({month:mm,original:hm['2026-'+mm],ticket:ticket['2026-'+mm],prior:hm['2025-'+mm]}));
      const hr=(hourly&&hourly.rows)||[],byHour={};hr.forEach(x=>{const h=Number.parseInt(String(x.hour??x.hour_start),10);if(!Number.isFinite(h))return;const z=byHour[h]||(byHour[h]={s:0});z.s+=Number(x.sales??x.sales_amount??x.gross_sales??0)});const topHours=Object.entries(byHour).sort((a,b)=>b[1].s-a[1].s).slice(0,3).map(x=>x[0]+'時').join('・')||'未集計';
      const dailyCount=(daily||[]).filter(x=>Number(x.total_sales||0)>0).length,coverage=q.coverage||{};
      const dataIssues=['長期原票には月別の客数が記載されています。客単価も「売上÷客数」で算出できます。月次比較へ反映しました。'];
      if(coverage.product_status!=='complete')dataIssues.push(active+'の商品別明細は '+(coverage.product_status==='unregistered'?'未登録':`${coverage.product_days}/${coverage.operating_days}営業日分`)+'です。日計売上は '+yen(q.daily)+'、うち商品内訳未取得は '+yen(q.product_breakdown_pending_total)+' です。商品グラフやビールを0円とは扱いません。');
      if(coverage.hourly_status!=='complete')dataIssues.push('時間帯別は '+(coverage.hourly_days||0)+'日分、日計は '+(coverage.operating_days||dailyCount)+'営業日分。時間帯は発行ベースの一部データです。');
      if(q.source_scope?.retained_original)dataIssues.push('原本恒久保存は '+q.source_scope.retained_original+'。保存先ID・SHA-256・容量がそろった写真だけを「原本あり」と判定します。'+(q.missing_retained_source_dates?.length?'未保存日：'+q.missing_retained_source_dates.join('、')+'。':'対象日の原本を追跡可能です。'));
      if(!q.matched&&q.hourly_anomaly_dates?.length)dataIssues.push('時間帯の発行額と精算後日計の差が大きい日：'+q.hourly_anomaly_dates.join('、')+'。発行ベースと精算後売上は別系列のため、一致とは表示しません。');
      if(!q.matched&&(coverage.product_status!=='complete'||coverage.hourly_status!=='complete'))dataIssues.push('「要確認」には内訳未登録が含まれます。日計売上が欠損・ゼロという意味ではありません。');
      dataIssues.push('シフトは端末内保存（localStorage）のため、別端末とはまだ自動共有されません。');
      const sameHtml=same.map(x=>`<tr><td>${x.year}年${Number(m)}月</td><td>${x.sales==null?'データなし':yen(x.sales)}</td><td>${x.customers==null?'—':Number(x.customers).toLocaleString()+'人'}</td><td>${x.avg==null?'—':yen(x.avg)}</td></tr>`).join('');
      const summerHtml=recentSummer.map(x=>`<tr><td>${Number(x.month)}月</td><td>${x.original?yen(x.original.sales):'データなし'}</td><td>${x.original?x.original.customers.toLocaleString()+'人':'データなし'}</td><td>${x.original?yen(x.original.avg):'データなし'}</td><td>${x.ticket?yen(x.ticket.sales):'データなし'}</td><td>${x.ticket?x.ticket.customers.toLocaleString()+'人':'データなし'}</td><td>${x.ticket?yen(x.ticket.avg_spend):'データなし'}</td><td>${x.prior&&x.original?((x.original.sales/x.prior.sales-1)*100).toFixed(1)+'%':'—'}</td></tr>`).join('');
      if(version!==executiveVersion||state.tab!=='executive'||scope!==currentScope())return;
      host.innerHTML=`<div class="panel" style="border-left:7px solid #17365d"><h2 style="margin:0 0 8px">みんなが最初に見る画面</h2><div class="sub">結論 → 数字 → 原因 → 今やること、の順だけで読めます。</div></div>
      <div class="cards" style="margin-top:10px"><div class="card"><div class="label">${active==='all'?'累計':active.replace('-','年')+'月'} 売上</div><div class="big">${active!=='all'&&!daily.length?'券売機未登録':yen(active==='all'?ov.total_sales:ov.month_sales)}</div><div class="sub">登録済み日計</div></div><div class="card"><div class="label">平均日商</div><div class="big">${yen(ov.avg_daily)}</div><div class="sub">売上÷営業日数</div></div><div class="card"><div class="label">客単価</div><div class="big">${yen(ov.avg_spend)}</div><div class="sub">売上÷客数</div></div><div class="card"><div class="label">データ状態</div><div class="big">${q.status}</div><div class="sub">${q.matched?'照合済み':(coverage.product_status==='complete'&&coverage.hourly_status==='complete'?'発行額と精算後日計を別系列で要確認':'内訳に未登録あり')}</div></div></div>
      <div class="grid2" style="margin-top:12px"><div class="panel"><h2>① まず結論</h2><div class="insight"><b>選択期間の実績を確認します。</b><br>売上と給与を同じ月・同じ系列で比較し、確認できた変化を見ます。</div><div class="insight"><b>長期では売上だけでなく客数と客単価も見ます。</b><br>原票の月次累計客数を反映し、客単価を計算できるようにしました。</div><div class="insight"><b>強い時間帯候補：</b> ${topHours}</div></div><div class="panel"><h2>② 今、何を確認するか</h2>${dataIssues.map(x=>`<div class="notice" style="margin:7px 0">${x}</div>`).join('')}</div></div>
      <div class="grid2" style="margin-top:12px"><div class="panel"><h2>③ 同月4年比較・長期原票系列</h2><div class="scroll"><table><thead><tr><th>年</th><th>売上</th><th>客数</th><th>客単価</th></tr></thead><tbody>${sameHtml}</tbody></table></div></div><div class="panel"><h2>④ 2026年 夏3か月・2系列比較</h2><div class="notice"><b>長期原票系列と券売機確定系列は別物です。</b> 黙って置き換えません。</div><div class="scroll"><table><thead><tr><th>月</th><th>原票売上</th><th>原票客数</th><th>原票客単価</th><th>券売機売上</th><th>券売機客数</th><th>券売機客単価</th><th>原票前年比</th></tr></thead><tbody>${summerHtml}</tbody></table></div></div></div>
      <div class="panel" style="margin-top:12px"><h2>⑤ みんなでこの順にやる</h2><div class="insight"><b>1.</b> 20〜23時へ人員集中。深夜2時台は採算を毎月検証。</div><div class="insight"><b>2.</b> ${coverage.product_status==='complete'?(active==='all'?'累計':Number(active.slice(5))+'月')+'の商品分析を使い、生ビール・瓶ビール・低回転品の施策を決める。':'商品別原票をそろえて、売れている商品・ビール・低回転品を確定する。'}</div><div class="insight"><b>3.</b> 売上・客数・客単価を前年同月とセットで見る。</div><div class="insight"><b>4.</b> 値上げは基本ラーメンとトッピングの整合を崩さない。</div></div>`;
      const summary=document.createElement('div');summary.className='panel';summary.id='fl-summary';summary.style.marginTop='12px';host.prepend(summary);await window.TsubasaFL.summary(summary,scope);
    }catch(e){if(version!==executiveVersion||state.tab!=='executive')return;host.innerHTML='<div class="panel notice ng">みんなのトップの読込に失敗しました。<br>'+String(e.message||e)+'</div>'}
  }

  function showNoProductData(tab){const title=tab==='beer'?'ビール・セット':tab==='abc'?'ABC分析':'商品別・全商品',q=state?.quality||{},c=q.coverage||{},partial=c.product_status==='partial',rows=Array.isArray(state?.products)?state.products:[];if(!partial){document.getElementById('host').innerHTML=`<div class="panel"><h2>${title}</h2><div class="notice ng"><b>未登録・分析不可</b><br>日計売上 ${yen(q.daily)} は確認済みです。商品名別の内訳が未登録であり、売上0円という意味ではありません。商品別原票が登録されるまで通常グラフは出しません。</div></div>`;return}const sorted=[...rows].sort((a,b)=>Number(b.sales)-Number(a.sales)),beer=sorted.filter(x=>/ビール/.test(x.name)),shown=tab==='beer'?beer:sorted;const detail=shown.length?table(['商品','登録済み出数','登録済み売上'],shown.map(x=>[x.name,Number(x.qty).toLocaleString(),yen(x.sales)]),true):'<div class="notice ng">登録済み明細を取得できません。</div>';document.getElementById('host').innerHTML=`<div class="panel"><h2>${title}</h2><div class="cards"><div class="card"><div class="label">月の日計売上</div><div class="big">${yen(q.daily)}</div><div class="sub">全営業日の確定売上</div></div><div class="card"><div class="label">商品内訳登録済み</div><div class="big">${yen(q.registered_product_total)}</div><div class="sub">${c.product_days}日分</div></div><div class="card"><div class="label">商品内訳未取得売上</div><div class="big">${yen(q.product_breakdown_pending_total)}</div><div class="sub">売上0円ではありません</div></div></div><div class="notice ng" style="margin-top:12px"><b>${c.operating_days}営業日中${c.product_days}日分の原票を登録済み</b><br>下表は登録済み日だけの参考集計です。月全体の順位・構成比・ABC判定は、全営業日分がそろうまで確定しません。</div><div style="margin-top:12px">${detail}</div></div>`}
  window.showNoProductData=showNoProductData;

  function injectHistoryCustomerPanel(){if(!location.pathname.endsWith('/history.html'))return;setTimeout(async()=>{try{const hist=await fetchHistoricalMonthly(),hm=histMonthly(hist),main=document.querySelector('main');if(!main||document.getElementById('histCustomerPanel'))return;const values=Object.keys(hm).map(month=>({month,...hm[month]}));const p=document.createElement('div');p.id='histCustomerPanel';p.className='panel';p.style='margin:11px 0';p.innerHTML=`<h2>月別 売上・客数・客単価（長期原票系列）</h2><div class="sub">37ページ原票（うち33ページは人件費表）の月末累計客数をDB登録。客単価＝月売上÷月客数。券売機確定系列とは混ぜません。</div><div class="toolbar"><label>並び順 <select id="histMonthlySort"><option value="month">年月順</option><option value="sales">売上順</option><option value="customers">客数順</option><option value="avg">客単価順</option></select></label></div><div class="scroll"><table><thead><tr><th>月</th><th>売上</th><th>客数</th><th>客単価</th><th>原票</th></tr></thead><tbody id="histMonthlyBody"></tbody></table></div>`;const draw=()=>{const key=p.querySelector('#histMonthlySort').value,rows=[...values].sort(key==='month'?(a,b)=>a.month.localeCompare(b.month):(a,b)=>b[key]-a[key]);p.querySelector('#histMonthlyBody').innerHTML=rows.map(x=>`<tr><td>${x.month}</td><td>${yen(x.sales)}</td><td>${x.customers.toLocaleString()}人</td><td>${yen(x.avg)}</td><td>${x.source_page}頁</td></tr>`).join('')};p.querySelector('#histMonthlySort').addEventListener('change',draw);draw();const toolbar=main.querySelector('.toolbar');toolbar?toolbar.after(p):main.prepend(p)}catch(e){console.error(e)}},900)}

  function injectCombinedHistoryPanel(){if(!location.pathname.endsWith('/history.html'))return;setTimeout(async()=>{try{const [historical,ticketDaily]=await Promise.all([fetchHistoricalMonthly(),fetchTicketDaily()]),main=document.querySelector('main');if(!main||document.getElementById('combinedHistoryPanel'))return;const original=histMonthly(historical),ticket={};ticketDaily.forEach(x=>{const month=String(x.business_date).slice(0,7),z=ticket[month]||(ticket[month]={sales:0,customers:0});z.sales+=Number(x.sales_total||0);z.customers+=Number(x.customer_count||0)});Object.values(ticket).forEach(x=>x.avg=x.customers?x.sales/x.customers:null);let originalCum=0,ticketCum=0;const rows=[...new Set([...Object.keys(original),...Object.keys(ticket)])].sort().map(month=>{const o=original[month],t=ticket[month];if(o)originalCum+=o.sales;if(t)ticketCum+=t.sales;return{month,originalSales:o?.sales??null,originalCustomers:o?.customers??null,originalAvg:o?.avg??null,originalCum:o?originalCum:null,ticketSales:t?.sales??null,ticketCustomers:t?.customers??null,ticketAvg:t?.avg??null,ticketCum:t?ticketCum:null}});let sort={key:'month',dir:1};const p=document.createElement('div');p.id='combinedHistoryPanel';p.className='panel';p.style='margin:11px 0';p.innerHTML=`<h2>長期原票＋最近の券売機確定値</h2><div class="notice"><b>同じ画面で最新月まで確認できます。</b> 長期原票と券売機確定値は異なる系列のため合算せず、月別値と系列ごとの累計を横並びにします。未登録は0円ではなく「データなし」です。</div><div class="sub" style="margin:8px 0">各列の見出しをクリックすると昇順／降順で並べ替えできます。</div><div class="scroll"><table><thead><tr>${[['month','年月'],['originalSales','長期原票 売上'],['originalCustomers','長期原票 客数'],['originalAvg','長期原票 客単価'],['originalCum','長期原票 累計'],['ticketSales','券売機確定 売上'],['ticketCustomers','券売機確定 客数'],['ticketAvg','券売機確定 客単価'],['ticketCum','券売機確定 累計']].map(([k,l])=>`<th data-key="${k}">${l} ↕</th>`).join('')}</tr></thead><tbody></tbody></table></div>`;const display=(v,kind)=>v==null?'<span class="na">データなし</span>':kind==='customers'?Number(v).toLocaleString()+'人':yen(v);const draw=()=>{const data=[...rows].sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;const c=typeof av==='number'?av-bv:String(av).localeCompare(String(bv));return c*sort.dir});p.querySelector('tbody').innerHTML=data.map(x=>`<tr><td>${x.month}</td><td>${display(x.originalSales)}</td><td>${display(x.originalCustomers,'customers')}</td><td>${display(x.originalAvg)}</td><td>${display(x.originalCum)}</td><td>${display(x.ticketSales)}</td><td>${display(x.ticketCustomers,'customers')}</td><td>${display(x.ticketAvg)}</td><td>${display(x.ticketCum)}</td></tr>`).join('')};p.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{const key=th.dataset.key;sort=sort.key===key?{key,dir:-sort.dir}:{key,dir:key==='month'?1:-1};draw()}));draw();const customer=document.getElementById('histCustomerPanel'),toolbar=main.querySelector('.toolbar');customer?customer.before(p):toolbar?toolbar.after(p):main.prepend(p)}catch(e){console.error(e)}},1100)}

  function integrate(){
    injectHistoryCustomerPanel();
    injectCombinedHistoryPanel();
    const tabs=document.querySelector('.tabs'),nav=document.querySelector('header nav');
    if(nav)nav.innerHTML='<button onclick="showTab(\'executive\')">みんなのトップ</button><button onclick="showTab(\'overview\')">通常ダッシュボード</button><button onclick="showTab(\'historyAll\')">長期実績</button><button onclick="showTab(\'consultAll\')">長期コンサル</button><button onclick="showTab(\'shiftAll\')">シフト</button>';
    if(tabs){const lead=document.createElement('div');lead.style='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px';lead.innerHTML='<button id="t_executive" style="background:#17365d;color:#fff" onclick="showTab(\'executive\')">みんなのトップ</button><button id="t_historyAll" onclick="showTab(\'historyAll\')">長期比較</button><button id="t_consultAll" onclick="showTab(\'consultAll\')">コンサル判断</button><button id="t_shiftAll" onclick="showTab(\'shiftAll\')">シフト作成</button>';tabs.parentNode.insertBefore(lead,tabs);const note=document.createElement('div');note.className='notice ok';note.style='margin-bottom:10px';note.innerHTML='<b>見方：</b> 最初は「みんなのトップ」を見てください。必要な時だけ長期比較・商品・時間帯・シフトへ進みます。';tabs.parentNode.insertBefore(note,tabs)}
    if(typeof window.showTab==='function'){const original=window.showTab;window.showTab=async function(tab,options={}){if(tab==='flTrends')tab='payroll';state.tab=tab;executiveVersion++;document.querySelectorAll('[id^="t_"]').forEach(x=>x.classList.remove('active'));const b=document.getElementById('t_'+tab);if(b)b.classList.add('active');if(tab==='payroll')return window.TsubasaFL.render(options);if(tab==='executive')return renderExecutive();if(tab==='historyAll')return iframePage('./history.html','長期実績・4年比較','売上だけでなく、原票の客数と計算客単価も表示します。');if(tab==='consultAll')return iframePage('./consulting-history.html','長期コンサル分析','社会情勢・インバウンド・経営批評・やるべきことを確認します。');if(tab==='shiftAll')return iframePage('./shift/','シフト作成','売上ピークと深夜割増を見ながら作成します。');if(['products','abc','beer'].includes(tab)&&state?.quality?.coverage?.product_status!=='complete')return showNoProductData(tab);return original(tab)}}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',integrate);else integrate();
})();

// FL/payroll trends are a separate module; retain all existing dashboard functions.
(function () {
  const base = document.currentScript ? document.currentScript.src : location.href;
  function loadFLTrends() {
    if (!document.getElementById('host') || document.getElementById('flTrendsScript')) return;
    const script = document.createElement('script');
    script.id = 'flTrendsScript';
    script.src = new URL('./fl-trends.js?v=20260920-fl-1', base).href;
    script.onerror = function () {
      const note = document.createElement('div');
      note.className = 'notice ng';
      note.textContent = 'FL・改善推移の画面モジュールを取得できませんでした。給与が0円という意味ではありません。再読み込みしてください。';
      document.getElementById('host').before(note);
    };
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadFLTrends, {once: true});
  else loadFLTrends();
})();
