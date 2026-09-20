(function(){
  'use strict';
  const M=window.TsubasaFLModel;
  const yen=v=>v==null?'未確定':'¥'+Math.round(v).toLocaleString('ja-JP');
  const pct=v=>v==null?'未確定':(v*100).toFixed(2)+'%';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ui={series:'historical',basis:'salary',mode:'all',start:'',end:'',key:'month',dir:1};
  let generation=0;
  const seriesLabel=()=>ui.series==='historical'?'長期原票':'券売機';
  const delta=(v,unit)=>`${Math.abs(v).toLocaleString('ja-JP',{maximumFractionDigits:2})}${unit}${v>0?'増加':v<0?'減少':'変化なし'}`;
  function narrative(rows){
    if(!rows.length)return 'この期間の給与は未登録です。0円として扱いません。';
    const first=rows[0],last=rows.at(-1),c=M.compare(rows);
    let text=rows.length>1&&first.salary!=null&&last.salary!=null?`${first.month} → ${last.month}：給与支給額は${yen(first.salary)}から${yen(last.salary)}へ、${delta(last.salary-first.salary,'円')}。`:'単月表示です。期間を広げると給与の変化を比較できます。';
    if(c)text+=` 同じ${seriesLabel()}系列の給与率は${pct(c.first.salary/c.first.sales)} → ${pct(c.last.salary/c.last.sales)}（${delta(c.rateChange*100,'ポイント')}）。売上は${delta(c.salesChange,'円')}。給与額の変化の寄与は${delta(c.payEffect*100,'ポイント')}、売上の変化の寄与は${delta(c.salesEffect*100,'ポイント')}です（開始月売上で給与変化を計算後、終了月売上へ置換）。`;
    else if(rows.length>1)text+=' 選択期間に同系列の売上欠損があるため、給与率の改善幅は算出しません。券売機は月次確定売上のある区間を指定してください。';
    const aug=rows.find(r=>r.month==='2026-08'),jul=rows.find(r=>r.month==='2026-07');
    if(aug){text+=aug.corrected?' 8月の確認事項：重複は修正版原票で解消済み。旧集計の増加は採用しません。':' 8月給与は確認事項あり。原票確認が必要です。';if(jul)text+=` 修正後の7月比は給与計${delta(aug.salary-jul.salary,'円')}（社員${delta(aug.employee-jul.employee,'円')}、アルバイト${delta(aug.parttime-jul.parttime,'円')}）。`;}
    return text+' 人員構成・営業日数・営業時間の変化を分離できていないため、施策やシフト改善だけの効果とは断定しません。';
  }
  function chart(rows,stack){
    const W=Math.max(800,rows.length*118),H=310,L=70,T=30,B=65,plot=H-T-B,step=(W-L-20)/Math.max(rows.length,1);
    const max=stack?Math.max(1,...rows.map(r=>r.salary||0))*1.14:Math.max(.7,...rows.flatMap(r=>[r.lRate||0,r.fRate||0,r.flRate||0]))*1.15;
    const y=v=>H-B-v/max*plot;
    let svg=`<svg role="img" aria-label="${stack?'月別給与の積み上げグラフ':'L率・F率・FL率の月別推移'}" viewBox="0 0 ${W} ${H}" style="min-width:${W}px"><title>${stack?'社員とアルバイトの支給額':'欠損月の線はつなぎません'}</title>`;
    for(let i=0;i<=4;i++){const v=max*i/4;svg+=`<line x1="${L}" y1="${y(v)}" x2="${W-20}" y2="${y(v)}" stroke="#dbe3ef"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="12">${stack?(v/10000).toFixed(0)+'万円':(v*100).toFixed(0)+'%'}</text>`;}
    rows.forEach((r,i)=>{const x=L+step*(i+.5);svg+=`<text x="${x}" y="${H-B+24}" text-anchor="middle" font-size="13">${esc(r.month)}</text>`;if(stack&&r.salary!=null){const bw=Math.min(65,step*.7);svg+=`<rect x="${x-bw/2}" y="${y(r.employee)}" width="${bw}" height="${r.employee/max*plot}" fill="#17365d"/><rect x="${x-bw/2}" y="${y(r.salary)}" width="${bw}" height="${r.parttime/max*plot}" fill="#287d8e"/><text x="${x}" y="${y(r.salary)-8}" text-anchor="middle" font-size="12">${yen(r.salary)}</text><text x="${x}" y="${H-22}" text-anchor="middle" font-size="11">社員 ${r.employee.toLocaleString()}</text><text x="${x}" y="${H-7}" text-anchor="middle" font-size="11">バイト ${r.parttime.toLocaleString()}</text>`;}});
    if(!stack)for(const [key,color] of [['lRate','#17365d'],['fRate','#287d8e'],['flRate','#b45309']])rows.forEach((r,i)=>{if(r[key]==null)return;const x=L+step*(i+.5),p=rows[i-1];if(p?.[key]!=null)svg+=`<line x1="${x-step}" y1="${y(p[key])}" x2="${x}" y2="${y(r[key])}" stroke="${color}" stroke-width="3"/>`;svg+=`<circle cx="${x}" cy="${y(r[key])}" r="4" fill="${color}"/><text x="${x}" y="${y(r[key])-10}" text-anchor="middle" font-size="12">${pct(r[key])}</text>`;});
    return `<div class="scroll fl-chart" tabindex="0">${svg}</svg></div>`;
  }
  function selected(rows){return ui.mode==='all'?rows:rows.filter(r=>r.month>=ui.start&&r.month<=(ui.mode==='single'?ui.start:ui.end));}
  async function render(options={}){
    const token=++generation,host=document.getElementById('host');
    host.innerHTML='<div class="panel">給与・FLを読み込み中...</div>';
    try{
      const input=await window.rev2Api('/api/fl-inputs');
      if(token!==generation||state.tab!=='payroll')return;
      const all=M.build(input,ui.series,ui.basis),months=all.map(r=>r.month);
      if(!ui.start)ui.start=months[0];if(!ui.end)ui.end=months.at(-1);
      if(options.scope){ui.mode=state.scope==='all'?'all':'single';ui.start=state.month;ui.end=state.month;}
      const selectMonths=[...new Set([...months,ui.start,ui.end].filter(Boolean))].sort();
      const opts=val=>selectMonths.map(m=>`<option value="${m}" ${m===val?'selected':''}>${m}</option>`).join('');
      const rows=selected(all),a=M.aggregate(rows);
      host.innerHTML=`<div id="fl-dashboard" class="panel"><div class="fl-title"><div><h2>FL・改善推移</h2><p>給与原票の支給計（非課税交通費を含む・控除前）。会社負担分は別途確認します。</p></div><button id="fl-back">みんなのトップへ戻る</button></div>
      <div class="toolbar fl-controls"><label>売上系列<select id="fl-series"><option value="historical">長期原票</option><option value="ticket">券売機</option></select></label><label>Lの範囲<select id="fl-basis"><option value="salary">給与支給額ベース</option><option value="total">会社負担を含む総人件費</option></select></label><label>期間<select id="fl-mode"><option value="all">全期間</option><option value="range">選択期間</option><option value="single">単月</option></select></label><label>開始月<select id="fl-start">${opts(ui.start)}</select></label><label>終了月<select id="fl-end">${opts(ui.end)}</select></label></div>
      <p id="fl-context">${seriesLabel()} ／ ${ui.basis==='salary'?'給与支給額ベース':'総人件費ベース（会社負担分未確認）'} ／ ${rows.length?rows[0].month+'〜'+rows.at(-1).month:'対象給与なし'}</p>
      <div class="cards" id="fl-totals">${[['給与支給額 累計',yen(a.salary)],['同系列売上 累計',yen(a.sales)],['L率（費用合計÷売上合計）',pct(a.lRate)],['F率',pct(a.fRate)],['FL率',pct(a.flRate)]].map(([l,v])=>`<div class="card"><div class="label">${l}</div><div class="big">${v}</div></div>`).join('')}</div>
      <p class="notice">系列がない月は代替・合算しません。累計に売上欠損が1月でもあれば累計率は未確定です。上部の売上カードは券売機日計、ここは上記の独立した期間・系列です。</p>
      <div id="fl-narrative" class="insight">${esc(narrative(rows))}</div>
      <h3>月別給与支給額</h3><p>紺：社員 ／ 青緑：アルバイト　金額：円。狭い画面ではグラフを横にスクロールできます。</p>${chart(rows,true)}
      <h3>L率・F率・FL率</h3><p>紺：L率 ／ 青緑：F率 ／ 茶：FL率　欠損月の線はつなぎません。</p>${chart(rows,false)}
      <p class="notice">月次原価未確定：全仕入先・全期間の網羅性と棚卸を未確認。登録済み部分は請求書の対象月による仕入ベースで、食材消費原価ではありません。F率・実績FL率は算出していません。</p>
      <h3>月別比較</h3><p>表は横にスクロールすると確認事項まで読めます。</p><div class="toolbar"><label>並べ替え<select id="fl-sort"><option value="month">年月</option><option value="sales">売上</option><option value="salary">給与額</option><option value="lRate">L率</option><option value="flRate">FL率</option></select></label><label>順序<select id="fl-direction"><option value="1">昇順</option><option value="-1">降順</option></select></label><span>未確定値は末尾</span></div>
      <div class="scroll" tabindex="0"><table id="fl-table"><thead><tr>${['年月','売上','売上出典','社員','アルバイト','給与計','確認済み会社負担額','L率','F額・状態','F率','FL率','確認事項'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      <details><summary>計算・原票確認の範囲</summary><p>給与原票は8.1〜8.8の8タブのみ。L23・L46・L48を明細と照合。1月タブの見出しに2月の記載が残っていますが、依頼者指定のタブ名を対象月とし、支給日と区別しています。</p><p>会社負担額：6・7月の既存登録額は社会保険の納付額と一致しますが、従業員控除分との分離・対象月は未確認。給与には加算しません。</p><p>仕入整理の修正版Excelも部分集計。既存の仕入数量画面には他の食材明細もありますが、酒類・飲料に請求書1頁目の欠落があり、月全体の網羅性は確認できません。DB未登録の資料内金額や空欄・0を月全体の実績にはしません。表の「登録済み部分」はDBの請求書正規行だけを対象とし、通帳支払を加算せず、家賃・光熱費・税・返済はFから除外しています。</p><p>売上−F−Lは、家賃・光熱費・その他経費控除前の残額であり利益ではありません。F未確定のため算出しません。</p></details></div>`;
      const draw=()=>{document.querySelector('#fl-table tbody').innerHTML=M.sort(rows,ui.key,ui.dir).map(r=>`<tr data-month="${r.month}"><th scope="row">${r.month}</th><td>${yen(r.sales)}</td><td>${seriesLabel()}<br>${esc(r.source)}</td><td>${yen(r.employee)}</td><td>${yen(r.parttime)}</td><td>${yen(r.salary)}</td><td>${yen(r.employer)}</td><td>${pct(r.lRate)}</td><td>月次原価未確定<br>${r.partial==null?'登録済み部分なし':`登録済み部分 ${yen(r.partial)}（仕入ベース）`}<br><small>${esc(r.partialSources.join(' / '))}</small></td><td>${pct(r.fRate)}</td><td>${pct(r.flRate)}</td><td>${r.corrected?'8月確認事項：重複修正済み。':r.month==='2026-08'?'8月給与は確認事項あり。':''}${r.month==='2026-01'?'原票見出しの月表記に相違。タブ名を採用。':''}${r.employerRecorded!=null?'社会保険料の既存登録 '+yen(r.employerRecorded)+' は納付額・会社負担分未確認。':'会社負担分未確認。'}</td></tr>`).join('');};
      for(const key of ['series','basis','mode']){const el=document.getElementById('fl-'+key);el.value=ui[key];el.onchange=()=>{ui[key]=el.value;render();};}
      for(const key of ['start','end'])document.getElementById('fl-'+key).onchange=e=>{ui[key]=e.target.value;ui.mode=ui.mode==='single'?'single':'range';if(ui.start>ui.end)ui[key==='start'?'end':'start']=ui[key];render();};
      document.getElementById('fl-end').disabled=ui.mode==='single';
      const sort=document.getElementById('fl-sort'),dir=document.getElementById('fl-direction');sort.value=ui.key;dir.value=String(ui.dir);
      sort.onchange=()=>{ui.key=sort.value;draw();};dir.onchange=()=>{ui.dir=Number(dir.value);draw();};
      document.getElementById('fl-back').onclick=()=>window.showTab('executive');draw();
    }catch(e){if(token===generation&&state.tab==='payroll')host.innerHTML='<div class="notice ng">給与・FLの取得に失敗しました。再度タブを開いてください。</div>';console.error(e);}
  }
  async function summary(container,scope){
    const input=await window.rev2Api('/api/fl-inputs');if(!container.isConnected)return;
    const rows=M.build(input),shown=scope==='all'?rows:rows.filter(r=>r.month===scope),a=M.aggregate(shown);
    const saved=ui.series;ui.series='historical';const text=narrative(rows);ui.series=saved;
    container.innerHTML=`<h2>給与・改善サマリー</h2><p>上部と同じ対象：${scope==='all'?'累計（給与登録月のみ）':esc(scope)} ／ 給与支給額 ${shown.length?yen(a.salary):'未登録'} ／ 長期原票の給与率 ${pct(a.lRate)}</p><p>${esc(text)}</p><p>F・FLは月次原価未確定。会社負担分は未確認。</p><button type="button">FL・改善推移で1〜8月を見る</button>`;
    container.querySelector('button').onclick=()=>{ui.mode='all';window.showTab('payroll');};
  }
  window.TsubasaFL={render,summary};
  window.__TSUBASA_FL_DIRECT__='2026-09-20-payroll-trends';
})();
