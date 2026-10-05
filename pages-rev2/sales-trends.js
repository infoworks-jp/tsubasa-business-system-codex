/* Monthly/yearly sales explorer. Read-only; no AI service, no payroll, no DB writes. */
(function (root) {
  'use strict';
  const VERSION = '20261005-sales-v1';
  const money = v => v == null ? 'データなし' : '¥' + Math.round(v).toLocaleString('ja-JP');
  const num = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ym = v => String(v || '').slice(0, 7);
  const validMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const pad = m => String(m).padStart(2, '0');
  const sources = {historical:'長期原票',ticket:'券売機'};
  const sourceLabels = {reference:'参考接続：券売機優先・無い月は長期原票',historical:'長期原票のみ',ticket:'券売機のみ'};

  function build(input) {
    const historical = new Map(), ticket = new Map(), summaries = new Map();
    function put(map, key, value) { if (map.has(key)) throw new Error(key + ' の月次データが重複しています。集計を止めました。'); map.set(key, value); }
    for (const r of input.historical || []) {
      const key = ym(r.month_start); if (!validMonth(key)) continue;
      put(historical,key,{month:key,sales:num(r.sales_total),source:'historical',partial:r.verification_status !== 'verified_from_original',through:null,detail:r.source_file || '月次原票'});
    }
    const seen = new Set();
    for (const r of input.daily || []) {
      if (r.status !== 'confirmed' || !validMonth(ym(r.business_date))) continue;
      if (seen.has(r.business_date)) throw new Error(r.business_date + ' の日計が重複しています。');
      seen.add(r.business_date);
      const key=ym(r.business_date), old=ticket.get(key)||{month:key,sales:0,source:'ticket',partial:true,through:'',detail:'登録済み日計の合計'};
      const value=num(r.sales_total); old.sales=value==null||old.sales==null?null:old.sales+value;
      if (String(r.business_date)>old.through) old.through=r.business_date;
      ticket.set(key,old);
    }
    for (const r of input.summary || []) {
      if (r.is_canonical !== true || r.status !== 'confirmed') continue;
      const key=ym(r.month_start); if (!validMonth(key)) continue;
      put(summaries,key,r);
      const old=ticket.get(key), value=num(r.sales_total);
      ticket.set(key,{month:key,sales:value,source:'ticket',partial:false,through:old?.through||null,detail:r.source||'月次確定',conflict:!!old&&(old.sales==null||value!==old.sales)});
      if (ticket.get(key).conflict) ticket.get(key).sales=null;
    }
    const keys=[...new Set([...historical.keys(),...ticket.keys()])].sort();
    const min=Number(keys[0]?.slice(0,4)), max=Number(keys.at(-1)?.slice(0,4));
    const years=keys.length?Array.from({length:max-min+1},(_,i)=>min+i):[];
    const latestClosed=[...ticket.values()].filter(r=>!r.partial&&!r.conflict).map(r=>r.month).sort().at(-1)||keys.at(-1);
    return {historical,ticket,years,latest:keys.at(-1),latestClosed,
      get(year,month,source) { const key=year+'-'+pad(month); return source==='historical'?historical.get(key)||null:source==='ticket'?ticket.get(key)||null:ticket.get(key)||historical.get(key)||null; }};
  }
  function annual(model,years,month,source) {
    return years.map(year=>{
      const entries=Array.from({length:month},(_,i)=>model.get(year,i+1,source));
      const available=entries.filter(r=>r&&r.sales!=null), complete=available.length===month&&available.every(r=>!r.partial&&!r.conflict);
      return {year,entries,sales:available.length?available.reduce((s,r)=>s+r.sales,0):null,months:available.length,complete,
        missing:entries.flatMap((r,i)=>!r||r.sales==null?[i+1]:[]),partial:available.some(r=>r.partial),sourceSignature:complete?entries.map(r=>r.source).join(','):null};
    });
  }
  function previousYear(row,rows) {
    const prior=rows.find(r=>r.year===row.year-1);
    return row.complete&&prior?.complete&&row.sourceSignature===prior.sourceSignature&&prior.sales>0?(row.sales/prior.sales-1):null;
  }
  function parseCommand(text,current,available,calendarYear) {
    let t=String(text||'').normalize('NFKC').trim();
    if (!t || t.length>160) throw new Error('例：「2026年の売上推移」「9月を年別比較」と入力してください。');
    t=t.replace(/令和\s*(\d+)\s*年/g,(_,n)=>(2018+Number(n))+'年').replace(/今年/g,calendarYear+'年').replace(/去年|昨年/g,(calendarYear-1)+'年');
    const years=[...new Set((t.match(/20\d{2}/g)||[]).map(Number))];
    const range=t.match(/(20\d{2})年?\s*(?:から|[〜～~\-])\s*(20\d{2})年?/);
    if (range) { const a=+range[1],b=+range[2];if(b<a||b-a>12)throw new Error('比較年は昇順で13年以内を指定してください。');years.splice(0,years.length,...Array.from({length:b-a+1},(_,i)=>a+i)); }
    const monthMatches=[...t.matchAll(/(?:^|[^\d])(1[0-2]|[1-9])月/g)].map(m=>+m[1]);
    if (/\b(?:0|1[3-9]|[2-9]\d)月/.test(t)) throw new Error('月は1〜12月を指定してください。');
    if (!years.length&&!monthMatches.length&&!/売上|売り上げ|比較|推移|年別|累計|年間|全年度/.test(t)) throw new Error('売上グラフの指定を入力してください。例：「2025年と2026年の売上推移」');
    if (/日別|客数|客単価|利益|予測|給与|人件費|FL/i.test(t)) throw new Error('ここでは月別・年別の売上を表示します。日別や人件費は専用タブをご利用ください。');
    const next={...current,years:years.length?years:/全(?:年|年度)|4年/.test(t)?[...available]:[...current.years]};
    if (/累計|年間|年合計|年別合計/.test(t)) { next.mode='annual';next.month=monthMatches.at(-1)||12;if(!years.length)next.years=[...available]; }
    else if (monthMatches.length===1 && !/推移|月別/.test(t)) { next.mode='same';next.month=monthMatches[0];if(!years.length)next.years=[...available]; }
    else { next.mode='trend'; }
    if (/券売機|POS/i.test(t)) next.source='ticket';
    else if (/長期原票|長期資料/.test(t)) next.source='historical';
    else if (/参考接続|両方/.test(t)) next.source='reference';
    return next;
  }
  const modelAPI={build,annual,previousYear,parseCommand};
  if (typeof module==='object'&&module.exports) module.exports=modelAPI;
  if (!root?.document) return;
  if (root.TsubasaSalesTrends) return;
  let snapshot, inflight, savedOptions;
  const doc=root.document;
  async function select(table,columns,order) {
    const c=root.TSUBASA_CONFIG;
    if(!c?.supabaseUrl||!c?.publishableKey)throw new Error('接続設定を確認できません。');
    const result=[];
    for(let start=0;start<1000000;start+=1000){
      const control=new AbortController(),timeout=setTimeout(()=>control.abort(),25000);
      try {
        const response=await root.fetch(c.supabaseUrl+'/rest/v1/'+table+'?select='+columns+'&order='+order,{headers:{apikey:c.publishableKey,'Accept-Profile':c.schema||'rev2','Range-Unit':'items',Range:start+'-'+(start+999)},cache:'no-store',signal:control.signal});
        if(!response.ok)throw new Error(table+' の読込に失敗しました（'+response.status+'）');
        const page=await response.json();if(!Array.isArray(page))throw new Error('データ形式を確認できません。');
        result.push(...page);if(page.length<1000)return result;
      } finally {clearTimeout(timeout);}
    }
    throw new Error('データ件数を確認できないため表示を停止しました。');
  }
  async function load(force) {
    if(force)snapshot=null;
    if(snapshot&&Date.now()-snapshot.at<60000)return snapshot;
    if(inflight)return inflight;
    inflight=Promise.all([
      select('historical_monthly_performance','month_start,sales_total,source_file,verification_status','month_start.asc'),
      select('monthly_summary','month_start,sales_total,status,is_canonical,source','month_start.asc'),
      select('daily_journal','business_date,sales_total,status','business_date.asc')
    ]).then(([historical,summary,daily])=>{snapshot={at:Date.now(),model:build({historical,summary,daily})};return snapshot;}).finally(()=>{inflight=null;});
    return inflight;
  }
  function styles(){if(doc.getElementById('st-style'))return;const s=doc.createElement('style');s.id='st-style';s.textContent=`
#dashboard>.toolbar[hidden],#cards[hidden],#integrity[hidden]{display:none!important}.st-root{background:#fff;border:1px solid #dbe3ee;border-radius:14px;padding:20px;margin:12px 0;color:#1e293b;font-family:inherit;min-width:0}.st-root *{box-sizing:border-box}.st-root h2{font-size:25px;margin:0 0 8px}.st-root h3{font-size:18px;margin:14px 0 6px}.st-sub{font-size:13px;color:#526478;line-height:1.7}.st-form{display:flex;gap:8px;margin:14px 0 8px;flex-wrap:wrap}.st-form input{min-width:180px;flex:1;font-size:16px;padding:12px;border:1px solid #9cacbd;border-radius:7px}.st-root button{font-size:14px;padding:10px 14px;border:1px solid #becbdd;border-radius:7px;background:#e8eef8;color:#17365d;cursor:pointer;font-weight:700}.st-root button[type=submit]{background:#17365d;color:#fff}.st-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0}.st-controls label{display:flex;gap:5px;flex-direction:column;font-size:13px;font-weight:600}.st-controls select{max-width:100%;font-size:14px;padding:9px;border:1px solid #bac7d6;border-radius:7px}.st-years{border:0;padding:0;margin:8px 0 14px;display:flex;gap:8px;flex-wrap:wrap}.st-years legend{font-size:13px;margin-bottom:6px}.st-years label{padding:8px 12px;border:1px solid #bbc9db;border-radius:7px;display:flex;gap:6px;align-items:center}.st-root .st-years input{padding:0;width:auto}.st-note{background:#fff7e6;border-left:4px solid #ba7900;padding:11px 14px;font-size:13px;line-height:1.7;margin:12px 0}.st-error{color:#a11616;background:#fff0f0;padding:10px;white-space:pre-wrap}.st-message{font-size:14px;margin:8px 0;min-height:20px}.st-chart{overflow-x:auto;border:1px solid #e1e7ef;border-radius:9px;background:#fcfdff}.st-chart svg{display:block;width:100%;min-width:650px;height:auto}.st-legend{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0;font-size:14px}.st-tip{background:#eff5fc;border-radius:7px;padding:10px;min-height:40px;font-size:14px;line-height:1.6}.st-scroll{overflow-x:auto;max-height:590px;margin-top:10px}.st-root table{border-collapse:collapse;width:100%;font-size:14px}.st-root th,.st-root td{padding:10px;border:1px solid #dbe3ee;text-align:right;white-space:nowrap}.st-root th{background:#17365d;color:#fff;cursor:pointer}.st-root th:first-child,.st-root td:first-child{text-align:left}.st-cell-note{font-size:11px;color:#5e7088;display:block;margin-top:4px}.st-root th[aria-sort=ascending]::after{content:' ▲'}.st-root th[aria-sort=descending]::after{content:' ▼'}.st-empty{padding:45px 20px;color:#607083;text-align:center}.st-actions{display:flex;gap:7px;flex-wrap:wrap}.st-root [hidden]{display:none!important}.st-root a{color:#174e96}.st-root [data-tip]:focus{outline:none;stroke:#111;stroke-width:3px}@media(max-width:650px){.st-root{padding:12px}.st-root h2{font-size:21px}.st-controls{display:grid;grid-template-columns:1fr 1fr}.st-controls label:last-of-type{grid-column:1/-1}.st-form input{width:100%}.st-root button{padding:9px 10px}.st-root td,.st-root th{padding:8px}}
`;doc.head.appendChild(s);}
  const palette=['#2465b4','#ad6400','#267665','#984b89','#56617c','#9b4e31'];
  function cellText(r){if(!r)return 'データなし';if(r.conflict)return '月次・日計の差額を要確認';if(r.sales==null)return '数値未登録';return money(r.sales);}
  function detail(r){if(!r)return '未登録';return sources[r.source]+(r.partial?'・途中集計'+(r.through?'（'+r.through+'まで）':''):'・月次登録');}
  function chart(series,labels,bar){
    const W=1000,H=365,L=86,R=30,T=38,B=54,iw=W-L-R,ih=H-T-B;
    const points=series.flatMap(s=>s.points).filter(r=>r&&r.sales!=null);
    if(!points.length)return '<div class="st-empty">選択条件に該当する売上データがありません。未登録を0円にはしていません。</div>';
    const maximum=Math.max(1,...points.map(r=>r.sales)),ceiling=Math.max(10000,Math.ceil(maximum/1000000)*1000000);
    const x=i=>L+(bar?(i+.5)*iw/labels.length:i*iw/Math.max(1,labels.length-1)),y=v=>T+ih-ih*v/ceiling;
    let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="売上比較グラフ・単位万円"><text x="16" y="22" font-size="13">万円</text>`;
    for(let i=0;i<=5;i++){const v=ceiling*i/5,Y=y(v);out+=`<line x1="${L}" x2="${W-R}" y1="${Y}" y2="${Y}" stroke="#dce4ed"/><text x="${L-12}" y="${Y+4}" text-anchor="end" font-size="13">${(v/10000).toLocaleString('ja-JP',{maximumFractionDigits:0})}</text>`;}
    labels.forEach((v,i)=>{out+=`<text x="${x(i)}" y="${H-24}" text-anchor="middle" font-size="14">${esc(v)}</text>`;});
    series.forEach((s,si)=>{
      const color=palette[si%palette.length];let last=null;
      s.points.forEach((r,i)=>{
        if(!r||r.sales==null){last=null;if(bar)out+=`<text x="${x(i)}" y="${H-B-10}" text-anchor="middle" font-size="13" fill="#66758b">データなし</text>`;return;}
        const X=x(i),Y=y(r.sales),tip=s.label+' '+labels[i]+' '+money(r.sales)+' ／ '+detail(r);
        if(bar){const width=Math.min(100,iw/labels.length*.55);out+=`<rect x="${X-width/2}" y="${Y}" width="${width}" height="${Math.max(2,H-B-Y)}" fill="${r.partial?'white':color}" stroke="${color}" stroke-width="2" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><title>${esc(tip)}</title></rect><text x="${X}" y="${Y-10}" text-anchor="middle" font-size="13" font-weight="700">${esc(money(r.sales))}${r.partial?'※':''}</text>`;}
        else {
          if(last&&last.r.source===r.source&&!last.r.partial&&!r.partial)out+=`<line x1="${last.x}" y1="${last.y}" x2="${X}" y2="${Y}" stroke="${color}" stroke-width="2.5"/>`;
          out+=`<circle cx="${X}" cy="${Y}" r="6" fill="${r.partial?'white':color}" stroke="${color}" stroke-width="2" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><title>${esc(tip)}</title></circle>`;
        }
        last={x:X,y:Y,r};
      });
    });return out+'</svg>';
  }
  async function mount(target,initial){
    styles();target.innerHTML='<div class="st-root"><h2>月別・年別 売上推移</h2><p class="st-message" role="status">月次の売上を読み込んでいます…</p></div>';
    try {
      let snap=await load(false);if(!target.isConnected)return;
      let model=snap.model;
      let opt=initial||savedOptions||{mode:'trend',years:[...model.years],month:Number(model.latestClosed?.slice(5)||12),source:'reference'};
      opt={...opt,years:[...opt.years]};let sorting={key:'label',dir:1};
      const box=target.firstElementChild;
      box.innerHTML=`<h2>月別・年別 売上推移</h2><div class="st-sub">年を選んで1〜12月を比較。同じ月の年別比較・年別累計にも切り替えられます。</div>
<form class="st-form"><input aria-label="売上グラフへの指示" maxlength="160" placeholder="例：2026年の売上推移 / 9月を年別比較"><button type="submit">指定して表示</button></form>
<div class="st-actions"><button type="button" data-command="全年度の月別売上推移">全年度の月別推移</button><button type="button" data-command="${model.years.at(-1)||2026}年の売上推移">最新年の月別推移</button><button type="button" data-command="9月を年別比較">9月の年別比較</button><button type="button" data-command="年別の9月まで累計">1〜9月の年別累計</button></div>
<div class="st-message" role="status" aria-live="polite"></div>
<div class="st-controls"><label>グラフの種類<select data-control="mode"><option value="trend">月別推移（年ごとの折れ線）</option><option value="same">同じ月を年別比較</option><option value="annual">年別累計（1月〜指定月）</option></select></label><label>比較月・累計の最終月<select data-control="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}月</option>`).join('')}</select></label><label>売上の出典<select data-control="source">${Object.entries(sourceLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><button type="button" data-refresh>最新データに更新</button></div>
<fieldset class="st-years"><legend>表示する年（複数選択可）</legend></fieldset>
<div class="st-note"></div><h3 data-title></h3><div class="st-legend"></div><div class="st-chart"></div><div class="st-tip" role="status" aria-live="polite">点・棒を押すと金額と出典を表示します。スマホではグラフ・表を横にスクロールできます。</div><div class="st-scroll"></div><div class="st-sub" data-updated></div>`;
      const q=s=>box.querySelector(s),message=q('.st-message');
      function controls(){q('[data-control=mode]').value=opt.mode;q('[data-control=month]').value=opt.month;q('[data-control=month]').disabled=opt.mode==='trend';q('[data-control=source]').value=opt.source;
        q('.st-years').innerHTML='<legend>表示する年（複数選択可）</legend>'+[...new Set([...model.years,...opt.years])].sort((a,b)=>a-b).map(year=>`<label><input type="checkbox" value="${year}" ${opt.years.includes(year)?'checked':''}>${year}年</label>`).join('');}
      function render(){
        savedOptions={...opt,years:[...opt.years]};controls();const years=[...opt.years].sort((a,b)=>a-b);
        q('[data-title]').textContent=opt.mode==='trend'?'1〜12月の売上推移':opt.mode==='same'?opt.month+'月の年別売上比較':'1〜'+opt.month+'月の年別累計';
        let note=opt.source==='reference'?'【参考接続】各月は券売機の月次値を優先し、無い月だけ長期原票を使います。同じ月の2系列は合算しません。出典が切り替わる場所では折れ線をつなぎません。':'【'+sourceLabels[opt.source]+'】別系列の数字で空欄を補いません。';
        note+=' 未登録は空欄・データなし。白抜きの点・棒と※は途中集計で、確定月との前年比は出しません。';
        if(opt.mode==='annual')note+=' 欠けた月がある年の合計は「登録分」であり、年間売上の確定値ではありません。前年比は同じ期間・同じ出典で全月が揃う場合のみです。';
        const pending=[];for(const year of years)for(let m=1;m<=12;m++){if(opt.mode==='same'&&m!==opt.month||opt.mode==='annual'&&m>opt.month)continue;const r=model.get(year,m,opt.source);if(r?.partial&&r.sales!=null)pending.push(year+'年'+m+'月 '+money(r.sales)+(r.through?'（'+r.through+'まで）':''));}
        if(pending.length)note+=' 【途中集計】'+pending.join('、')+'。通月の確定売上ではありません。';
        q('.st-note').textContent=note;
        let series,labels,headers,rows;
        if(opt.mode==='trend'){
          labels=Array.from({length:12},(_,i)=>(i+1)+'月');series=years.map(year=>({label:year+'年',points:labels.map((_,i)=>model.get(year,i+1,opt.source))}));
          headers=[{key:'label',label:'月'},...years.map(y=>({key:String(y),label:y+'年'}))];
          rows=labels.map((label,i)=>({label,order:i+1,cells:years.map(y=>model.get(y,i+1,opt.source))}));
        }else if(opt.mode==='same'){
          labels=years.map(y=>y+'年');series=[{label:opt.month+'月',points:years.map(y=>model.get(y,opt.month,opt.source))}];headers=[{key:'label',label:'年'},{key:'sales',label:'売上'},{key:'source',label:'出典・状態'}];
          rows=years.map(y=>({label:y+'年',order:y,cells:[model.get(y,opt.month,opt.source)]}));
        }else{
          labels=years.map(y=>y+'年');const totals=annual(model,years,opt.month,opt.source);
          series=[{label:'1〜'+opt.month+'月 累計',points:totals.map(t=>({sales:t.sales,source:'ticket',partial:!t.complete,through:null}))}];
          headers=[{key:'label',label:'年'},{key:'sales',label:'登録分合計'},{key:'coverage',label:'揃った月'},{key:'yoy',label:'同条件の前年比'}];
          rows=totals.map(t=>({label:t.year+'年',order:t.year,cells:[{sales:t.sales}],total:t,yoy:previousYear(t,totals)}));
        }
        q('.st-legend').innerHTML=opt.mode==='trend'?series.map((s,i)=>`<span><b style="color:${palette[i%palette.length]}">━━</b> ${esc(s.label)}</span>`).join(''):'<span>白抜き・※：途中集計または一部の月のみ</span>';
        q('.st-chart').innerHTML=years.length?chart(series,labels,opt.mode!=='trend'):'<div class="st-empty">表示する年を選んでください。</div>';
        // Annual bar tooltips must not mislabel a reference/mixed aggregate as ticket sales.
        if(opt.mode==='annual')q('.st-chart').querySelectorAll('[data-tip]').forEach((node,i)=>{const r=rows.filter(r=>r.cells[0].sales!=null)[i];if(r){const t=r.total;node.dataset.tip=r.label+' 1〜'+opt.month+'月 '+money(t.sales)+' ／ '+sourceLabels[opt.source]+' ／ '+t.months+'/'+opt.month+'か月'+(!t.complete?'・登録分のみ':'');node.setAttribute('aria-label',node.dataset.tip);node.querySelector('title').textContent=node.dataset.tip;}});
        const idx=headers.findIndex(h=>h.key===sorting.key);
        function value(row){if(idx<=0)return row.order;if(sorting.key==='coverage')return row.total?.months;if(sorting.key==='yoy')return row.yoy;if(sorting.key==='source')return row.cells[0]?.source;return row.cells[opt.mode==='trend'?idx-1:0]?.sales;}
        const ordered=[...rows].sort((a,b)=>{const av=value(a),bv=value(b);if(av==null)return bv==null?0:1;if(bv==null)return -1;return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv)))*sorting.dir;});
        const cell=r=>esc(cellText(r))+`<span class="st-cell-note">${esc(detail(r))}</span>`;
        q('.st-scroll').innerHTML='<table><thead><tr>'+headers.map(h=>`<th tabindex="0" data-sort="${h.key}" aria-sort="${sorting.key===h.key?(sorting.dir===1?'ascending':'descending'):'none'}">${esc(h.label)}</th>`).join('')+'</tr></thead><tbody>'+ordered.map(row=>'<tr><td>'+row.label+'</td>'+ (opt.mode==='trend'?row.cells.map(r=>'<td>'+cell(r)+'</td>').join(''):opt.mode==='same'?'<td>'+cell(row.cells[0])+'</td><td>'+esc(detail(row.cells[0]))+'</td>':'<td>'+money(row.total.sales)+(!row.total.complete?'<span class="st-cell-note">登録分のみ</span>':'')+'</td><td>'+row.total.months+'/'+opt.month+'か月'+(row.total.missing.length?'<span class="st-cell-note">未登録：'+row.total.missing.join('・')+'月</span>':'')+(row.total.partial?'<span class="st-cell-note">途中集計あり</span>':'')+'</td><td>'+(row.yoy==null?'比較条件未充足':(row.yoy>=0?'+':'')+(row.yoy*100).toFixed(1)+'%')+'</td>')+'</tr>').join('')+'</tbody></table>';
        q('[data-updated]').textContent='取得時刻：'+new Date(snap.at).toLocaleString('ja-JP')+' ／ 読取専用。売上や給与の元データは変更しません。表の見出しで並べ替えできます。';
      }
      function apply(text){try{opt=parseCommand(text,opt,model.years,new Date().getFullYear());sorting={key:'label',dir:1};message.classList.remove('st-error');message.textContent='表示指定を反映しました。';render();}catch(e){message.classList.add('st-error');message.textContent=e.message;}}
      q('form').addEventListener('submit',e=>{e.preventDefault();apply(q('form input').value);});
      box.addEventListener('click',e=>{const command=e.target.closest('[data-command]');if(command){q('form input').value=command.dataset.command;apply(command.dataset.command);}const th=e.target.closest('[data-sort]');if(th){sorting={key:th.dataset.sort,dir:sorting.key===th.dataset.sort?-sorting.dir:1};render();}const point=e.target.closest('[data-tip]');if(point)q('.st-tip').textContent=point.dataset.tip;});
      box.addEventListener('focusin',e=>{if(e.target.dataset.tip)q('.st-tip').textContent=e.target.dataset.tip;});
      box.addEventListener('keydown',e=>{if(e.target.dataset.sort&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click();}});
      box.addEventListener('change',e=>{const key=e.target.dataset.control;if(key){opt[key]=key==='month'?Number(e.target.value):e.target.value;sorting={key:'label',dir:1};render();}else if(e.target.matches('.st-years input')){opt.years=[...box.querySelectorAll('.st-years input:checked')].map(n=>Number(n.value));render();}});
      q('[data-refresh]').addEventListener('click',async e=>{e.target.disabled=true;message.textContent='更新中…';try{snap=await load(true);model=snap.model;render();message.textContent='最新データに更新しました。';}catch(error){message.classList.add('st-error');message.textContent='更新失敗：'+error.message+'。表示中の取得時刻を確認してください。';}finally{e.target.disabled=false;}});
      render();
    } catch(e){if(target.isConnected){target.innerHTML='<div class="st-root"><h2>月別・年別 売上推移</h2><div class="st-error">'+esc(e.name==='AbortError'?'接続がタイムアウトしました。':e.message)+'</div><button type="button">再読み込み</button></div>';target.querySelector('button').onclick=()=>mount(target,initial);}}
  }
  function integrate(){
    if(!doc.getElementById('host')||typeof root.showTab!=='function')return;
    const previous=root.showTab;let direct=root.location.hash==='#sales-trends';
    function routeHash(value){try{root.history.replaceState(null,'',value||root.location.href.replace(/#.*$/,''));}catch(_){/* Embedded/restricted views still support button navigation. */}}
    doc.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&/showTab/.test(button.getAttribute('onclick')||'')&&!/salesTrends/.test(button.getAttribute('onclick'))){direct=false;if(root.location.hash==='#sales-trends')routeHash('');}},true);
    function hideSummary(on){['cards','integrity'].forEach(id=>{const el=doc.getElementById(id);if(el)el.hidden=on;});const bar=doc.querySelector('#dashboard > .toolbar');if(bar)bar.hidden=on;}
    root.showTab=async function(tab){
      if(direct&&tab==='executive')tab='salesTrends';
      if(tab!=='salesTrends'&&tab!=='executive'){direct=false;if(root.location.hash==='#sales-trends')routeHash('');}
      hideSummary(tab==='salesTrends');
      if(tab==='salesTrends'){
        if(typeof state!=='undefined')state.tab='salesTrends';
        doc.querySelectorAll('[id^="t_"]').forEach(b=>b.classList.toggle('active',b.id==='t_salesTrends'));
        const host=doc.getElementById('host');host.innerHTML='<div id="sales-trend-panel"></div>';
        return mount(host.firstElementChild);
      }
      const result=await previous.apply(this,arguments);
      if(tab==='historyAll'){
        const host=doc.getElementById('host');if(!host.querySelector('#sales-trend-panel')){const panel=doc.createElement('div');panel.id='sales-trend-panel';host.prepend(panel);mount(panel);}
      }
      return result;
    };
    const add=(parent,id)=>{if(!parent||doc.getElementById(id))return;const button=doc.createElement('button');button.id=id;button.textContent='月別・年別売上';button.type='button';button.onclick=()=>{direct=true;routeHash('#sales-trends');root.showTab('salesTrends');};parent.appendChild(button);};
    add(doc.querySelector('header nav'),'nav_salesTrends');add(doc.querySelector('.tabs'),'t_salesTrends');
    if(direct)root.showTab('salesTrends');
    else if(doc.querySelector('#host iframe[src*="history.html"]')){const panel=doc.createElement('div');panel.id='sales-trend-panel';doc.getElementById('host').prepend(panel);mount(panel);}
  }
  root.TsubasaSalesTrends={...modelAPI,mount,version:VERSION};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',integrate,{once:true});else integrate();
})(typeof window!=='undefined'?window:null);
