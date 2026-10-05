/* Same-month comparisons for every recorded month. Read-only; never joins amounts from different sources. */
(function (root) {
  'use strict';
  const VERSION = '20261005-all-months-v1';
  const number = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const monthKey = v => String(v || '').slice(0, 7);
  const valid = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  const pad = n => String(n).padStart(2, '0');
  const money = n => n == null ? 'データなし' : '¥' + Math.round(n).toLocaleString('ja-JP');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function build(input) {
    const historical = new Map(), ticket = new Map(), closed = new Set(), seen = new Set();
    for (const r of input.historical || []) {
      const key = monthKey(r.month_start); if (!valid(key)) continue;
      if (historical.has(key)) throw new Error(key + 'の長期原票が重複しています。');
      historical.set(key, {month:key, sales:number(r.sales_total), source:'historical', partial:r.verification_status !== 'verified_from_original', through:null});
    }
    for (const r of input.daily || []) {
      const key = monthKey(r.business_date); if (r.status !== 'confirmed' || !valid(key)) continue;
      if (seen.has(r.business_date)) throw new Error(r.business_date + 'の日計が重複しています。');
      seen.add(r.business_date);
      const row = ticket.get(key) || {month:key, sales:0, source:'ticket', partial:true, through:''};
      const n = number(r.sales_total); row.sales = n == null || row.sales == null ? null : row.sales + n;
      if (String(r.business_date) > row.through) row.through = r.business_date;
      ticket.set(key, row);
    }
    for (const r of input.summary || []) {
      const key = monthKey(r.month_start); if (!valid(key) || r.is_canonical !== true || r.status !== 'confirmed') continue;
      if (closed.has(key)) throw new Error(key + 'の月次確定値が重複しています。');
      closed.add(key);
      const prior = ticket.get(key), sales = number(r.sales_total);
      const conflict = !!prior && (prior.sales == null || prior.sales !== sales);
      ticket.set(key, {month:key, sales:conflict ? null : sales, source:'ticket', partial:false, through:prior?.through || null, conflict});
    }
    const keys = [...new Set([...historical.keys(), ...ticket.keys()])].sort();
    const first = Number(keys[0]?.slice(0, 4)), last = Number(keys.at(-1)?.slice(0, 4));
    const years = keys.length ? Array.from({length:last-first+1}, (_, i) => first+i) : [];
    const get = (year, month, source='combined') => {
      const key = year + '-' + pad(month), h = historical.get(key), t = ticket.get(key);
      if (source === 'historical') return h || null;
      if (source === 'ticket') return t || null;
      return h?.sales != null ? h : t || h || null;
    };
    return {years, get, keys, latestClosed:[...closed].sort().at(-1) || keys.at(-1),
      months(source='combined') { return Array.from({length:12}, (_, i) => i+1).filter(m => years.some(y => get(y, m, source))); }
    };
  }
  function change(current, prior) {
    if (!current || !prior || current.sales == null || !(prior.sales > 0)) return null;
    if (current.partial || prior.partial || current.conflict || prior.conflict || current.source !== prior.source) return null;
    return current.sales / prior.sales - 1;
  }
  function provenance(row) {
    if (!row) return '記録なし';
    if (row.conflict) return '月次と日計の差を要確認';
    if (row.source === 'historical') return row.partial ? '長期原票・要確認' : '長期原票';
    return row.partial ? '券売機・途中' + (row.through ? '（' + row.through.slice(5).replace('-', '/') + 'まで）' : '') : '券売機・月次確定';
  }
  const exported = {build, change, provenance, version:VERSION};
  if (typeof module === 'object' && module.exports) module.exports = exported;
  if (!root.document) return;
  const doc = root.document, palette = ['#52627c','#287d86','#c38225','#215ab3','#825799','#416e46'];
  let model, source = 'combined', selectedMonth = null, generation = 0;
  async function select(table, columns, order) {
    const c = root.TSUBASA_CONFIG;
    if (!c?.supabaseUrl || !c?.publishableKey) throw new Error('接続設定を確認できません。');
    const rows = [];
    for (let offset=0; offset<1000000; offset+=1000) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await root.fetch(c.supabaseUrl + '/rest/v1/' + table + '?select=' + columns + '&order=' + order, {
          headers:{apikey:c.publishableKey, 'Accept-Profile':c.schema || 'rev2', 'Range-Unit':'items', Range:offset+'-'+(offset+999)},
          cache:'no-store', signal:controller.signal
        });
        if (!res.ok) throw new Error(table + 'の取得失敗（' + res.status + '）');
        const page = await res.json(); if (!Array.isArray(page)) throw new Error('データ形式が不正です。');
        rows.push(...page); if (page.length<1000) return rows;
      } finally {clearTimeout(timer);}
    }
    throw new Error('取得件数の上限に達しました。');
  }
  function styles() {
    if (doc.getElementById('yc-style')) return;
    const s = doc.createElement('style'); s.id = 'yc-style';
    s.textContent = `
#yearComparison{min-width:0;scroll-margin-top:15px}#yearComparison h2{margin:0 0 8px;font-size:25px}#yearComparison *{box-sizing:border-box}.yc-note{font-size:13px;line-height:1.7;color:#526478;margin:8px 0}.yc-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}.yc-controls label{font-weight:700;font-size:13px}.yc-controls select{max-width:100%}.yc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.yc-card{border:1px solid #ccd8e6;border-radius:10px;padding:12px;min-width:0}.yc-card h3{margin:0 0 6px}.yc-card h3 button{padding:5px 10px;background:#edf3fb;border:0;font-size:18px;color:#17365d}.yc-card[data-selected=true]{border:2px solid #215ab3;padding:11px}.yc-row{padding:7px 0;border-top:1px solid #edf1f6}.yc-top{display:grid;grid-template-columns:60px minmax(85px,1fr) 85px;gap:5px;align-items:center;font-size:13px}.yc-value{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.yc-change{text-align:right;font-size:11px}.yc-positive{color:#176c41}.yc-negative{color:#ad2929}.yc-track{height:10px;background:#edf1f6;border-radius:4px;margin:5px 0 3px;overflow:hidden}.yc-fill{height:100%;border-radius:4px}.yc-partial .yc-fill{background-image:repeating-linear-gradient(45deg,transparent,transparent 4px,#ffffff80 4px,#ffffff80 7px)}.yc-source{font-size:11px;color:#546579;min-height:16px;overflow-wrap:anywhere}.yc-missing{color:#778598}.yc-missing .yc-track{background:transparent;border-bottom:1px dashed #d6dfe9;border-radius:0}.yc-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin:10px 0}.yc-detail{margin-top:18px;border-top:1px solid #dbe3ee;padding-top:15px}.yc-detail h3{margin:8px 0}.yc-detail-scroll{overflow-x:auto}.yc-detail-chart{display:flex;align-items:flex-end;gap:16px;min-width:360px;min-height:320px;padding:12px 8px;border-bottom:1px solid #ccd8e6}.yc-col{flex:1;min-width:80px;text-align:center;font-size:13px}.yc-column{width:48px;margin:6px auto;background:#215ab3;border-radius:5px 5px 0 0}.yc-detail .yc-source{font-size:11px;min-height:36px;white-space:normal}.yc-empty{padding:25px;background:#f5f7fb;color:#617187}.yc-error{padding:14px;background:#fff0ef;color:#991b1b}.yc-legend b{margin-right:5px}.yc-stamp{font-size:11px;color:#64748b;margin:10px 0 0}@media(max-width:1100px){.yc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.yc-grid{grid-template-columns:1fr}.yc-controls{align-items:stretch}.yc-controls label{display:flex;flex-direction:column;gap:5px;width:100%}#yearComparison h2{font-size:22px}.yc-detail-chart{min-width:350px;gap:8px}}
`; doc.head.appendChild(s);
  }
  function rowHTML(year, month, maximum) {
    const r = model.get(year, month, source), previous = model.get(year-1, month, source), delta = change(r, previous);
    const color = palette[model.years.indexOf(year) % palette.length];
    let diff = delta == null ? '—' : (delta >= 0 ? '+' : '') + (delta*100).toFixed(1) + '%';
    let reason = '前年同月の比較対象なし';
    if (delta != null) reason = '同じ出典の前年同月比';
    else if (r?.partial || previous?.partial) {diff='途中・対象外';reason='途中集計と通月を比較しません';}
    else if (r && previous && r.source !== previous.source) {diff='出典差あり';reason='出典が違うため前年比を算出しません';}
    const value = r?.conflict ? '要確認' : money(r?.sales);
    return `<div class="yc-row ${r?.sales == null ? 'yc-missing' : ''} ${r?.partial ? 'yc-partial' : ''}" data-year="${year}"><div class="yc-top"><b>${year}年</b><strong class="yc-value">${esc(value)}</strong><span class="yc-change ${delta == null ? '' : delta >= 0 ? 'yc-positive' : 'yc-negative'}" title="${reason}">${diff}</span></div><div class="yc-track">${r?.sales == null ? '' : `<div class="yc-fill" style="width:${Math.max(0,r.sales)/maximum*100}%;background-color:${color}"></div>`}</div><div class="yc-source">${esc(provenance(r))}</div></div>`;
  }
  function drawDetail() {
    const el = doc.getElementById('yc-detail-graph'); if (!el || !model || !selectedMonth) return;
    const rows = model.years.map(y => model.get(y, selectedMonth, source));
    const maximum = Math.max(1,...rows.map(r => r?.sales || 0));
    doc.getElementById('yc-detail-title').textContent = selectedMonth + '月・年代別比較';
    el.innerHTML = `<div class="yc-detail-chart">${model.years.map((year,i)=>{
      const r=rows[i], value=r?.conflict?'要確認':money(r?.sales), height=r?.sales == null ? 0 : Math.max(0,r.sales)/maximum*210;
      return `<div class="yc-col" data-year="${year}"><strong>${esc(value)}</strong><div class="yc-column" style="height:${height}px;background:${palette[i%palette.length]};${r?.partial?'border:2px dashed #17365d;opacity:.65;':''}"></div><b>${year}年</b><div class="yc-source">${esc(provenance(r))}</div></div>`;
    }).join('')}</div>`;
    doc.querySelectorAll('.yc-card').forEach(c=>c.dataset.selected=String(Number(c.dataset.month)===selectedMonth));
  }
  function draw() {
    const host=doc.getElementById('yearComparison'); if(!host || !model) return;
    const months=model.months(source);
    if(!months.includes(selectedMonth))selectedMonth=months.includes(Number(model.latestClosed?.slice(5)))?Number(model.latestClosed.slice(5)):months.at(-1);
    const maximum=Math.max(1,...months.flatMap(m=>model.years.map(y=>model.get(y,m,source)?.sales || 0)));
    host.innerHTML=`<h2>年代別比較</h2><p class="yc-note">記録のある全月を、月ごとに年別比較します。各月の見出しを押すと下段に拡大表示します。棒の長さは全月共通の尺度です。</p><div class="yc-controls"><label>表示する記録 <select id="yc-source"><option value="combined">全記録（長期原票優先・不足月は券売機）</option><option value="historical">長期原票のみ</option><option value="ticket">券売機のみ</option></select></label><button id="yc-reload" type="button">最新データを取得</button></div><p class="yc-note">${source==='combined'?'長期原票にある月はその値を維持し、ない月は券売機の月次確定値・登録済み日計を表示します。出典の異なる金額は足しません。':'選択した出典だけを表示します。他の出典の値で穴埋めしません。'} 未登録は「データなし」。途中集計は通月扱いせず、前年比は直前の年・同じ出典・確定月同士だけで計算します。</p><div class="yc-legend">${model.years.map((y,i)=>`<span><b style="color:${palette[i%palette.length]}">━</b>${y}年</span>`).join('')}</div><div id="yearCompare" class="yc-grid">${months.length?months.map(m=>`<section class="yc-card" data-month="${m}"><h3><button type="button" data-month="${m}" aria-label="${m}月を拡大表示">${m}月</button></h3>${model.years.map(y=>rowHTML(y,m,maximum)).join('')}</section>`).join(''):'<div class="yc-empty">この出典の記録はありません。</div>'}</div>${months.length?`<section class="yc-detail"><div class="yc-controls"><label>拡大する月 <select id="yc-detail-month">${months.map(m=>`<option value="${m}">${m}月</option>`).join('')}</select></label></div><h3 id="yc-detail-title"></h3><div class="yc-detail-scroll" id="yc-detail-graph"></div></section>`:''}<p class="yc-stamp">表示版 ${VERSION} ／ 記録のある ${months.length}か月・${model.years.length}年分</p>`;
    doc.getElementById('yc-source').value=source;
    doc.getElementById('yc-source').onchange=e=>{source=e.target.value;draw();};
    doc.getElementById('yc-reload').onclick=()=>load();
    const detail=doc.getElementById('yc-detail-month');
    if(detail){detail.value=String(selectedMonth);detail.onchange=e=>{selectedMonth=Number(e.target.value);drawDetail();};}
    host.querySelectorAll('h3 button[data-month]').forEach(b=>b.onclick=()=>{selectedMonth=Number(b.dataset.month);detail.value=String(selectedMonth);drawDetail();doc.getElementById('yc-detail-title').scrollIntoView({block:'start',behavior:'smooth'});});
    drawDetail();
  }
  async function load() {
    const host=doc.getElementById('yearComparison'); if(!host)return;
    const id=++generation;styles();
    host.innerHTML='<h2>年代別比較</h2><p role="status">記録のある全月を読み込み中…</p>';
    try {
      const [historical,summary,daily]=await Promise.all([
        select('historical_monthly_performance','month_start,sales_total,verification_status,source_file','month_start.asc'),
        select('monthly_summary','month_start,sales_total,status,is_canonical','month_start.asc'),
        select('daily_journal','business_date,sales_total,status','business_date.asc')
      ]);
      if(id!==generation)return;model=build({historical,summary,daily});draw();
    }catch(e){if(id!==generation)return;host.innerHTML='<h2>年代別比較</h2><p class="yc-error">'+esc(e.message)+'。取得失敗を0円として扱いません。</p><button id="yc-retry" type="button">再取得</button>';doc.getElementById('yc-retry').onclick=()=>load();}
  }
  root.TsubasaYearComparison={...exported,load};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>load(),{once:true});else load();
})(typeof window==='undefined'?globalThis:window);
