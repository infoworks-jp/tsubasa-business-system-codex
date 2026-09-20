/* Tsubasa: source-aware payroll and F/L trends. No individual payroll is exposed. */
(function (root) {
  'use strict';
  const VERSION = '20260920-fl-1';
  const num = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const ym = v => String(v || '').slice(0, 7);
  const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const completeSum = (rows, key) => rows.length && rows.every(r => num(r[key]) !== null) ? sum(rows, key) : null;
  const foodCategory = s => /^(食材|麺|餃子|イクラ|酒類|飲料).*仕入/.test(String(s || ''));
  const verified = s => ['confirmed', 'verified_from_original', '確認済み', '確定'].includes(s);
  function model(raw, mode) {
    const pays = raw.payroll || [], originals = raw.historical_monthly_performance || [], tickets = raw.monthly_summary || [];
    const costs = raw.monthly_operating_costs || [], expenses = raw.expenses || [], bank = raw.bank_transactions || [];
    const seen = new Set();
    return [...pays].sort((a, b) => a.payroll_month.localeCompare(b.payroll_month)).map(p => {
      const month = ym(p.payroll_month);
      if (seen.has(month)) throw new Error(month + ' の給与が重複しています');
      seen.add(month);
      const h = originals.find(r => ym(r.month_start) === month);
      const t = tickets.find(r => ym(r.month_start) === month && r.is_canonical === true && r.status === 'confirmed');
      const employee = num(p.employee_gross), parttime = num(p.parttime_gross), salary = num(p.gross_pay);
      const salaryOK = salary !== null && employee !== null && parttime !== null && salary === employee + parttime;
      const sales = num((mode === 'ticket' ? t : h)?.sales_total);
      const mc = costs.filter(r => ym(r.month_start) === month && verified(r.verification_status));
      // Only explicit monthly totals certify full F or employer-only cost. A few invoices do not.
      const ff = mc.filter(r => r.cost_type === 'food_cost_total');
      const ee = mc.filter(r => r.cost_type === 'employer_labor_cost_total');
      const rr = mc.filter(r => r.cost_type === 'rent');
      const food = ff.length === 1 ? num(ff[0].amount) : null;
      const employer = ee.length === 1 ? num(ee[0].amount) : null;
      const labor = salaryOK && (p.employer_cost_included === true || employer !== null)
        ? salary + (p.employer_cost_included === true ? 0 : employer) : null;
      const accrued = expenses.filter(r => ym(r.expense_date) === month && r.is_canonical === true && verified(r.status) && foodCategory(r.category));
      const paid = bank.filter(r => ym(r.transaction_date) === month && num(r.withdrawal_amount) > 0 && r.match_status === 'matched' && foodCategory(r.estimated_category));
      const unclassified = bank.filter(r => ym(r.transaction_date) === month && num(r.withdrawal_amount) > 0 && /未分類|仕入・外注支払|^振込$|現金経費|^経費$/.test(r.estimated_category || ''));
      const fl = food !== null && labor !== null ? food + labor : null;
      const rent = rr.length ? sum(rr, 'amount') : null;
      const ratio = v => sales > 0 && v !== null ? v / sales : null;
      return {month, sales, employee, parttime, salary, salaryOK, salaryRate: ratio(salaryOK ? salary : null),
        employerRegistered: num(p.employer_cost), employer, labor, laborRate: ratio(labor), food, foodRate: ratio(food), fl, flRate: ratio(fl),
        rent, flr: fl !== null && rent !== null ? fl + rent : null, flrRate: ratio(fl !== null && rent !== null ? fl + rent : null),
        accrued: accrued.length ? sum(accrued, 'amount') : null, accruedCount: accrued.length,
        foodPaid: paid.length ? sum(paid, 'withdrawal_amount') : null, paidCount: paid.length,
        unclassifiedCount: unclassified.length, pending: /要確認|未確定|暫定/.test(p.status || ''),
        salesSource: mode === 'ticket' ? '券売機月次確定' : '長期原票', updated: p.updated_at || null};
    });
  }
  function totals(rows) {
    const sales = completeSum(rows, 'sales'), salary = rows.every(r => r.salaryOK) ? completeSum(rows, 'salary') : null;
    const food = completeSum(rows, 'food'), labor = completeSum(rows, 'labor'), fl = completeSum(rows, 'fl'), flr = completeSum(rows, 'flr');
    return {sales, salary, food, labor, fl, flr, employee: completeSum(rows, 'employee'), parttime: completeSum(rows, 'parttime'),
      salaryRate: sales > 0 && salary !== null ? salary / sales : null,
      flRate: sales > 0 && fl !== null ? fl / sales : null,
      flrRate: sales > 0 && flr !== null ? flr / sales : null};
  }
  function compare(rows) {
    if (rows.length < 6) return null;
    const first = rows.slice(0, 3), last = rows.slice(-3);
    if (![...first, ...last].every(r => r.salaryOK)) return null;
    const before = sum(first, 'salary') / 3, after = sum(last, 'salary') / 3;
    return {first, last, before, after, saving: before - after, rate: before > 0 ? (before - after) / before : null};
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {model, totals, compare, foodCategory}; return; }
  const doc = root.document;
  if (!doc || !doc.getElementById('host') && doc.readyState !== 'loading') return;
  let cache = null, currentRows = [], salesMode = 'historical', sort = {key: 'month', dir: 1}, requestId = 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yen = n => n === null ? '未集計' : '¥' + Math.round(n).toLocaleString('ja-JP');
  const pct = n => n === null ? '未確定' : (n * 100).toFixed(1) + '%';
  const label = m => m.slice(0,4) + '年' + Number(m.slice(5)) + '月';
  const short = m => Number(m.slice(5)) + '月';
  async function getTable(table, columns, order) {
    const c = root.TSUBASA_CONFIG, out = [], size = 500;
    for (let offset = 0; ; offset += size) {
      if (offset > 100000) throw new Error(table + ' の取得件数上限を超えました');
      const u = c.supabaseUrl + '/rest/v1/' + table + '?select=' + columns + '&order=' + order + '&limit=' + size + '&offset=' + offset;
      const r = await fetch(u, {headers: {apikey: c.publishableKey, 'Accept-Profile': c.schema}, cache: 'no-store'});
      if (!r.ok) throw new Error(table + ' の取得に失敗（' + r.status + '）');
      const page = await r.json();
      if (!Array.isArray(page)) throw new Error(table + ' の応答が不正です');
      out.push(...page);
      if (page.length < size) return out;
    }
  }
  async function load() {
    if (!cache) {
      const defs = [
        ['payroll','payroll_month,monthly_sales,employee_gross,parttime_gross,gross_pay,employer_cost,employer_cost_included,status,updated_at','payroll_month.asc'],
        ['historical_monthly_performance','month_start,sales_total','month_start.asc'],
        ['monthly_summary','month_start,sales_total,is_canonical,status','month_start.asc'],
        ['monthly_operating_costs','id,month_start,cost_type,amount,verification_status','id.asc'],
        ['expenses','id,expense_date,category,amount,status,is_canonical','id.asc'],
        ['bank_transactions','id,transaction_date,withdrawal_amount,estimated_category,match_status','id.asc']
      ];
      cache = Promise.all(defs.map(d => getTable(...d))).then(sets => Object.fromEntries(defs.map((d,i) => [d[0], sets[i]]))).catch(e => {cache = null; throw e;});
    }
    return cache;
  }
  function styles() {
    if (doc.getElementById('flStyles')) return;
    const el = doc.createElement('style'); el.id = 'flStyles';
    el.textContent = `.fl{margin:14px 0;color:#1f2937}.fl h2{margin:0 0 10px}.fl h3{margin:5px 0 12px}.fl .fl-lead{font-size:18px;line-height:1.65}.fl .fl-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}.fl .fl-box{padding:16px;background:#f5f8fc;border:1px solid #d9e2f3;border-radius:9px}.fl .fl-value{font-size:26px;font-weight:800;color:#17365d;margin:6px 0}.fl .fl-note{font-size:13px;line-height:1.7;color:#475569}.fl .fl-good{color:#166534}.fl .fl-alert{padding:12px;background:#fff4db;border-left:4px solid #d99a20;margin:12px 0;line-height:1.7}.fl .fl-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:14px 0}.fl label{display:grid;gap:5px;font-size:13px}.fl select{max-width:100%}.fl .fl-graphs{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fl .fl-chart{min-width:0;border:1px solid #e2e8f0;border-radius:9px;padding:12px}.fl svg{display:block;width:100%;height:auto}.fl .fl-table{overflow:auto;margin:14px 0}.fl table{font-size:13px}.fl th button{color:inherit;background:transparent;padding:0}.fl details{margin:12px 0}.fl summary{cursor:pointer;font-weight:700}.fl .fl-na{color:#64748b;font-size:12px}.fl .fl-badge{display:inline-block;background:#fff4db;padding:2px 6px;border-radius:4px;font-size:11px}.fl .fl-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px}.fl .fl-legend i{display:inline-block;width:18px;height:3px;vertical-align:middle;margin-right:5px}.fl .fl-row{margin:10px 0}.fl tfoot{font-weight:bold;background:#eaf2fb}@media(max-width:750px){.fl .fl-graphs,.fl .fl-kpis{grid-template-columns:1fr}.fl .fl-value{font-size:24px}.fl .fl-controls label{width:100%}}`;
    doc.head.appendChild(el);
  }
  function graph(rows, keys, percent) {
    const series = keys.map(([key, name, color]) => ({key,name,color}));
    const vals = rows.flatMap(r => keys.map(([k]) => r[k])).filter(v => v !== null && Number.isFinite(v));
    if (!vals.length) return '<div class="fl-alert">対象期間の値を確定できません。ゼロのグラフは表示しません。</div>';
    const W=720,H=295,L=72,R=30,T=36,B=52,max=Math.max(...vals)*1.2||1;
    const x=i=>L+(W-L-R)*i/Math.max(rows.length-1,1),y=v=>H-B-(H-T-B)*v/max;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(keys.map(k=>k[1]).join('・'))}の月別推移"><title>欠損値は線をつながず、ゼロにしません</title>`;
    for(let i=0;i<=4;i++){const v=max*i/4;svg+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#dce3ed"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="12">${percent?(v*100).toFixed(0)+'%':(v/10000).toFixed(0)+'万円'}</text>`;}
    rows.forEach((r,i)=>{svg+=`<text x="${x(i)}" y="${H-22}" text-anchor="middle" font-size="12">${short(r.month)}</text>`;});
    series.forEach((s,si)=>{let prev=null;rows.forEach((r,i)=>{const v=r[s.key];if(v===null||!Number.isFinite(v)){prev=null;return;}if(prev!==null)svg+=`<line x1="${x(prev.i)}" y1="${y(prev.v)}" x2="${x(i)}" y2="${y(v)}" stroke="${s.color}" stroke-width="3"/>`;svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="${r.pending?'white':s.color}" stroke="${s.color}" stroke-width="2"><title>${r.month} ${esc(s.name)} ${percent?pct(v):yen(v)}${r.pending?'（原票内確認待ち）':''}</title></circle>`;if(si===0)svg+=`<text x="${x(i)}" y="${y(v)-12}" text-anchor="middle" font-size="12" font-weight="bold" fill="${s.color}">${percent?pct(v):(v/10000).toFixed(1)+'万'}</text>`;prev={i,v};});});
    return svg+'</svg><div class="fl-legend">'+series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')+'</div>';
  }
  function headline(rows) {
    const c=compare(rows), latest=rows.at(-1);
    if(!latest)return '<div class="fl-alert">給与データが未登録です。</div>';
    if(!c)return `<p class="fl-lead">給与と売上の負担を月ごとに確認します。</p>`;
    return `<div class="fl-lead"><b>給与支給額の負担は${c.saving>=0?'減っています':'増えています'}。</b> ${short(c.first[0].month)}〜${short(c.first.at(-1).month)}と${short(c.last[0].month)}〜${short(c.last.at(-1).month)}を比較すると、月平均で<b>${yen(Math.abs(c.saving))}${c.saving>=0?'減少':'増加'}</b>しています。</div><div class="fl-kpis"><div class="fl-box">最初の3か月・給与月平均<div class="fl-value">${yen(c.before)}</div><div class="fl-note">${c.first[0].month}〜${c.first.at(-1).month}</div></div><div class="fl-box">直近3か月・給与月平均<div class="fl-value">${yen(c.after)}</div><div class="fl-note">${c.last[0].month}〜${c.last.at(-1).month}</div></div><div class="fl-box">給与額の変化<div class="fl-value fl-good">${c.saving>=0?'減少':'増加'} ${pct(Math.abs(c.rate))}</div><div class="fl-note">社会保険の会社負担を含まない比較。8月など原票確認待ちの月は原票合計のまま含みます。</div></div></div>`;
  }
  function periodRows(){const a=doc.getElementById('flFrom')?.value,b=doc.getElementById('flTo')?.value;return currentRows.filter(r=>(!a||r.month>=a)&&(!b||r.month<=b));}
  function draw() {
    const rows=periodRows(), rootEl=doc.getElementById('flView');if(!rootEl)return;
    const total=totals(rows);
    rootEl.querySelector('#flPeriod').innerHTML=rows.length?`<b>${label(rows[0].month)}〜${label(rows.at(-1).month)}・${rows.length}か月</b>　給与累計 <b>${yen(total.salary)}</b> ／ 期間給与比率 <b>${pct(total.salaryRate)}</b><div class="fl-note">比率は合計給与÷同じ期間の合計売上。月ごとの比率の単純平均ではありません。</div>`:'開始月と終了月を確認してください。';
    rootEl.querySelector('#flSalaryGraph').innerHTML=graph(rows,[['salary','給与総支給','#17365d'],['employee','正社員','#53856b'],['parttime','アルバイト','#ba702e']],false);
    rootEl.querySelector('#flRateGraph').innerHTML=graph(rows,[['salaryRate','給与比率','#4472c4'],['foodRate','F比率（確定月）','#b57925'],['laborRate','L比率（会社負担込み確定月）','#337b63'],['flRate','FL比率（確定月）','#8f537c'],['flrRate','FLR比率（確定月）','#6a647e']],true);
    const cols=[['month','月'],['sales','売上'],['employee','正社員支給'],['parttime','バイト支給'],['salary','給与支給計'],['salaryRate','給与比率'],['food','F・月原価'],['labor','L・会社負担込み'],['flRate','FL比率'],['flrRate','FLR比率']];
    const ordered=[...rows].sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(av===null)return bv===null?0:1;if(bv===null)return-1;return(typeof av==='number'?av-bv:String(av).localeCompare(String(bv)))*sort.dir;});
    const cell=(r,k)=>k==='month'?short(r.month)+(r.pending?' <span class="fl-badge">原票確認待ち</span>':''):k.endsWith('Rate')?pct(r[k]):yen(r[k]);
    rootEl.querySelector('#flTable').innerHTML=`<table><thead><tr>${cols.map(([k,t])=>`<th><button data-sort="${k}">${t} ${sort.key===k?(sort.dir===1?'↑':'↓'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${ordered.map(r=>'<tr>'+cols.map(([k])=>`<td>${cell(r,k)}</td>`).join('')+'</tr>').join('')}</tbody><tfoot><tr><td>期間合計</td><td>${yen(total.sales)}</td><td>${yen(total.employee)}</td><td>${yen(total.parttime)}</td><td>${yen(total.salary)}</td><td>${pct(total.salaryRate)}</td><td>${yen(total.food)}</td><td>${yen(total.labor)}</td><td>${pct(total.flRate)}</td><td>${pct(total.flrRate)}</td></tr></tfoot></table>`;
    rootEl.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.sort;sort=sort.key===key?{key,dir:-sort.dir}:{key,dir:key==='month'?1:-1};draw();});
    rootEl.querySelector('#flCoverage').innerHTML=`<table><thead><tr><th>月</th><th>食材・飲料費の登録済み部分<br>発生月・請求書</th><th>食材・飲料支払の分類済み部分<br>支払月・通帳</th><th>登録社保参考額</th><th>家賃登録額 R</th><th>正式FLの状態</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.month}</td><td>${yen(r.accrued)}${r.accruedCount?'／'+r.accruedCount+'件':''}</td><td>${yen(r.foodPaid)}${r.paidCount?'／'+r.paidCount+'件':''}</td><td>${yen(r.employerRegistered)}</td><td>${yen(r.rent)}</td><td>${r.fl!==null?'算出可能':'月原価・会社負担額の突合待ち'}${r.unclassifiedCount?'／使途の集計確認対象 '+r.unclassifiedCount+'件':''}</td></tr>`).join('')}</tbody></table>`;
    rootEl.querySelector('#flSource').textContent=salesMode==='ticket'?'売上は券売機月次確定系列。未登録月は長期原票から穴埋めしません。':'売上は長期原票系列で統一。同一系列のまま1〜8月を比較します。券売機確定系列とは金額が異なる月があります。';
  }
  async function renderFull() {
    const id=++requestId,host=doc.getElementById('host');if(!host)return;
    host.innerHTML='<section class="panel fl"><h2>FL・改善推移</h2><p>給与・原価・売上を読み込み中…</p></section>';
    try {
      const raw=await load();if(id!==requestId)return;currentRows=model(raw,salesMode);
      const opts=currentRows.map(r=>`<option value="${r.month}">${label(r.month)}</option>`).join('');
      host.innerHTML=`<section class="panel fl" id="flView"><h2>給与・FLの推移｜努力を数字で確認</h2>${headline(currentRows)}<div class="fl-note">給与の減少は原票から確認できます。ただし、人員数・勤務時間・営業日数の変化を分けていないため、削減額の全てを効率化や利益増と断定しません。</div><div class="fl-controls"><label>売上の系列<select id="flSalesMode"><option value="historical">長期原票で統一</option><option value="ticket">券売機月次確定のみ</option></select></label><label>開始月<select id="flFrom">${opts}</select></label><label>終了月<select id="flTo">${opts}</select></label><button id="flAll">全期間</button><button id="flReload">最新データを再取得</button></div><div class="fl-note">この画面の対象期間は上の開始月・終了月で選択します。給与が未登録の9月以降を0円として追加しません。</div><div id="flSource" class="fl-alert"></div><div id="flPeriod" class="fl-box"></div><div class="fl-graphs fl-row"><div class="fl-chart"><h3>給与支給額の推移</h3><div id="flSalaryGraph"></div></div><div class="fl-chart"><h3>給与・F・L・FL・FLR比率</h3><div id="flRateGraph"></div><div class="fl-note">F・L・FL・FLRは月全体の根拠がそろった点だけ描画します。未確定の月を0%で結びません。</div></div></div><div id="flTable" class="fl-table"></div><div class="fl-alert"><b>給与比率と正式なL・FL比率は別です。</b><br>給与支給計には交通費を含みます。正式Lは給与＋会社負担の社保等。通帳の社保納付総額をそのまま会社負担へ二重加算しません。8月の同名・同額行は原票のまま残し、確認待ちとして表示しています。</div><details open><summary>F・社保・家賃：どこまで入っているか</summary><p class="fl-note">下の金額は登録済み部分です。請求書と通帳は同じ支払を重複して含み得るため合算しません。登録が少ない月を「原価削減に成功」とは判定しません。</p><div id="flCoverage" class="fl-table"></div></details><details><summary>計算と資料の見方</summary><p class="fl-note">給与：今回の給与一覧表の8.1〜8.8タブ、社員計・アルバイト計・総合計。月の表記はユーザー指定のタブ名を採用します。<br>F：食材・麺・餃子・イクラ・酒類・飲料の対象月原価。家賃・税金・外注全額は含めません。<br>L：給与支給計＋会社負担社保・労働保険等（給与に含む場合は重複加算しない）。FL=(F+L)÷売上、FLR=(F+L+R家賃)÷売上。<br>給与比率＝給与支給計÷売上。FL後残額は営業利益ではありません。個人名・個人別給与はこの画面に表示しません。</p></details><div class="fl-note">表示版 ${VERSION} ／ ${new Date().toLocaleString('ja-JP')}取得</div></section>`;
      doc.getElementById('flTo').value=currentRows.at(-1)?.month||'';
      doc.getElementById('flSalesMode').value=salesMode;
      doc.getElementById('flSalesMode').onchange=e=>{salesMode=e.target.value;currentRows=model(raw,salesMode);draw();};
      doc.getElementById('flFrom').onchange=draw;doc.getElementById('flTo').onchange=draw;
      doc.getElementById('flAll').onclick=()=>{doc.getElementById('flFrom').value=currentRows[0]?.month||'';doc.getElementById('flTo').value=currentRows.at(-1)?.month||'';draw();};
      doc.getElementById('flReload').onclick=()=>{cache=null;renderFull();};
      draw();
    } catch(e) {if(id===requestId)host.innerHTML='<section class="panel fl"><h2>FL・改善推移</h2><div class="fl-alert">'+esc(e.message)+'。取得失敗を0円として表示していません。</div><button id="flRetry">再取得</button></section>';doc.getElementById('flRetry')?.addEventListener('click',()=>{cache=null;renderFull();});}
  }
  async function summary(host, id) {
    try {
      const raw=await load();if(id!==requestId||doc.getElementById('flSummary')||!host.isConnected)return;
      const rows=model(raw,'historical'),p=doc.createElement('section');p.className='panel fl';p.id='flSummary';
      p.innerHTML='<h2>給与・FL｜改善の経過</h2>'+headline(rows)+'<div class="fl-note">給与の推移は8か月分。正式FLは月原価と会社負担社保の突合待ちです。未確定をゼロで表示しません。</div><button id="flOpen">8か月のグラフ・累計・FLを見る</button>';
      const first=host.firstElementChild;first?first.after(p):host.appendChild(p);p.querySelector('button').onclick=()=>root.showTab('flTrends');
    }catch(e){console.error('FL summary:',e);}
  }
  function install() {
    if(!doc.getElementById('host')||root.__tsubasaFLInstalled)return;
    root.__tsubasaFLInstalled=true;styles();
    const tabs=doc.querySelector('.tabs');if(tabs&&!doc.getElementById('t_flTrends')){const b=doc.createElement('button');b.id='t_flTrends';b.textContent='FL・改善推移';b.onclick=()=>root.showTab('flTrends');const overview=doc.getElementById('t_overview');overview?overview.after(b):tabs.prepend(b);}
    const prior=root.showTab;
    root.showTab=async function(tab){
      const id=++requestId;
      if(typeof state!=='undefined')state.tab=tab;
      if(tab==='flTrends'||tab==='payroll'){
        doc.querySelectorAll('[id^="t_"]').forEach(b=>b.classList.remove('active'));
        doc.getElementById('t_'+tab)?.classList.add('active');return renderFull();
      }
      const result=await prior(tab);
      if(['overview','executive'].includes(tab))await summary(doc.getElementById('host'),id);
      return result;
    };
    root.TsubasaFL={version:VERSION,model,totals,compare,refresh:()=>{cache=null;return renderFull();}};
    if(location.hash==='#fl')root.showTab('flTrends');
    else if(typeof state!=='undefined'&&['overview','executive'].includes(state.tab))summary(doc.getElementById('host'),requestId);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof window==='undefined'?globalThis:window);
