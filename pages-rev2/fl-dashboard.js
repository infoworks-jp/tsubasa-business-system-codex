// Standalone F/L dashboard renderer / 2026-08-17
(function(){
  'use strict';
  const FOOD_RE=/食材|麺|餃子|イクラ|酒類|飲料/;
  const BENCHMARKS={food:'25〜35%',labor:'25〜35%',fl:'55〜65%'};
  const yen=v=>'¥'+Math.round(Number(v||0)).toLocaleString('ja-JP');
  const pct=v=>v==null?'未確定':(Number(v)*100).toFixed(1)+'%';
  const ym=m=>{const [y,mo]=String(m||'').split('-');return y&&mo?`${Number(y)}年${Number(mo)}月`:m||''};
  async function load(){
    if(typeof window.rev2Api!=='function') return null;
    const [monthly,expenses,payroll]=await Promise.all([window.rev2Api('/api/monthly'),window.rev2Api('/api/expenses'),window.rev2Api('/api/payroll')]);
    const map=new Map(monthly.map(r=>[r.month,{month:r.month,sales:+r.sales||0,food:0,labor:null}]));
    expenses.forEach(r=>{if(!FOOD_RE.test(String(r.category||'')))return;const m=String(r.date||'').slice(0,7);if(map.has(m))map.get(m).food+=+r.amount||0;});
    payroll.forEach(r=>{const x=map.get(r.year_month);if(!x)return;const social=r.social_insurance==null?null:+r.social_insurance;x.labor=social==null?null:(+r.salary_paid||0)+social;});
    return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(x=>({...x,fRate:x.sales?x.food/x.sales:null,lRate:x.sales&&x.labor!=null?x.labor/x.sales:null,flRate:x.sales&&x.labor!=null?(x.food+x.labor)/x.sales:null}));
  }
  function calc(rows){const sales=rows.reduce((s,r)=>s+r.sales,0),food=rows.reduce((s,r)=>s+r.food,0),known=rows.length>0&&rows.every(r=>r.labor!=null),labor=known?rows.reduce((s,r)=>s+r.labor,0):null;return{sales,food,labor,fRate:sales?food/sales:null,lRate:sales&&labor!=null?labor/sales:null,flRate:sales&&labor!=null?(food+labor)/sales:null};}
  function table(rows){return `<div class="scroll"><table><thead><tr><th>月</th><th>売上</th><th>F原価</th><th>F率</th><th>L人件費</th><th>L率</th><th>F/L率</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${ym(r.month)}</td><td>${yen(r.sales)}</td><td>${yen(r.food)}</td><td>${pct(r.fRate)}</td><td>${r.labor==null?'未確定':yen(r.labor)}</td><td>${pct(r.lRate)}</td><td><b>${pct(r.flRate)}</b></td></tr>`).join('')}</tbody></table></div>`;}
  function chart(rows){const data=rows.filter(r=>r.sales),W=900,H=290,L=55,R=20,T=25,B=45,max=Math.max(70,...data.flatMap(r=>[r.fRate||0,r.lRate||0,r.flRate||0]).map(v=>v*100)),step=(W-L-R)/Math.max(1,data.length-1),Y=v=>H-B-(v/max)*(H-T-B),points=k=>data.map((r,i)=>`${L+i*step},${Y((r[k]||0)*100)}`).join(' ');let s=`<svg viewBox="0 0 ${W} ${H}">`;for(let i=0;i<=4;i++){const v=max*(1-i/4),y=T+i*(H-T-B)/4;s+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#dbe3ef"/><text x="${L-7}" y="${y+4}" text-anchor="end" font-size="11">${v.toFixed(0)}%</text>`}s+=`<polyline fill="none" stroke="#5b9bd5" stroke-width="3" points="${points('fRate')}"/><polyline fill="none" stroke="#70ad47" stroke-width="3" points="${points('lRate')}"/><polyline fill="none" stroke="#ed7d31" stroke-width="3" points="${points('flRate')}"/>`;data.forEach((r,i)=>{const x=L+i*step;s+=`<text x="${x}" y="${H-18}" text-anchor="middle" font-size="11">${Number(r.month.slice(5))}月</text>`});return s+'</svg>';}
  function benchmarkNote(){return `<div class="notice" style="margin:10px 0"><b>一般的な飲食店の目安</b>　F（食材原価率）${BENCHMARKS.food} ／ L（人件費率）${BENCHMARKS.labor} ／ F/L合計 ${BENCHMARKS.fl}。<span class="sub">業態・営業時間・客単価・立地で適正値は変わるため、絶対基準ではなく経営判断の目安として使用。</span></div>`;}
  function installPayrollBenchmark(){
    const host=document.getElementById('host');
    if(!host||!document.getElementById('t_payroll')?.classList.contains('active'))return;
    if(host.querySelector('.payroll-benchmark-note'))return;
    const note=document.createElement('div');
    note.className='notice payroll-benchmark-note';
    note.style.marginBottom='12px';
    note.innerHTML=`<b>人件費率の目安</b>　一般的な飲食店では売上の <b>${BENCHMARKS.labor}</b> 程度が一つの目安です。F/L合計では <b>${BENCHMARKS.fl}</b> 程度が目安。<span class="sub">社会保険など事業主負担を含めた実質人件費で見る。業態・営業時間・人員体制で適正値は変動。</span>`;
    host.insertAdjacentElement('afterbegin',note);
  }
  function watchPayroll(){
    const host=document.getElementById('host');if(!host)return;
    const observer=new MutationObserver(()=>setTimeout(installPayrollBenchmark,0));
    observer.observe(host,{childList:true,subtree:true});
    document.getElementById('t_payroll')?.addEventListener('click',()=>setTimeout(installPayrollBenchmark,50));
    installPayrollBenchmark();
  }
  async function render(){
    const rows=await load();if(!rows)return;
    const month=document.getElementById('monthSelect')?.value||rows.at(-1)?.month;
    const current=rows.filter(r=>r.month===month),cum=calc(rows),cur=calc(current);
    let box=document.getElementById('fl-direct-panel');
    if(!box){box=document.createElement('div');box.id='fl-direct-panel';box.className='panel';box.style.margin='12px 0';const integrity=document.getElementById('integrity');if(integrity)integrity.insertAdjacentElement('afterend',box);else document.querySelector('main')?.prepend(box);}
    box.innerHTML=`<h3>F/L 経営指標</h3>${benchmarkNote()}<div class="cards"><div class="card"><div class="label">${ym(month)} F原価率</div><div class="big">${pct(cur.fRate)}</div><div class="sub">${yen(cur.food)} ／ 目安 ${BENCHMARKS.food}</div></div><div class="card"><div class="label">${ym(month)} L人件費率</div><div class="big">${pct(cur.lRate)}</div><div class="sub">${cur.labor==null?'社会保険未確定':yen(cur.labor)} ／ 目安 ${BENCHMARKS.labor}</div></div><div class="card"><div class="label">${ym(month)} F/L比率</div><div class="big">${pct(cur.flRate)}</div><div class="sub">${cur.labor==null?'未確定':yen(cur.food+cur.labor)} ／ 目安 ${BENCHMARKS.fl}</div></div><div class="card"><div class="label">累計 F/L比率</div><div class="big">${pct(cum.flRate)}</div><div class="sub">売上 ${yen(cum.sales)} ／ 目安 ${BENCHMARKS.fl}</div></div></div><div style="margin-top:12px"><h3>F/L 月別推移</h3><div class="sub">F＝食材・麺・餃子・イクラ・酒類・飲料　L＝給与総支給＋事業主負担社会保険</div>${chart(rows)}${table(rows)}<div class="notice ok" style="margin-top:10px"><b>累計</b>　売上 ${yen(cum.sales)} ／ F ${yen(cum.food)}（${pct(cum.fRate)}）／ L ${cum.labor==null?'未確定':yen(cum.labor)+'（'+pct(cum.lRate)+'）'} ／ F/L ${pct(cum.flRate)}</div></div>`;
  }
  function boot(){render().catch(e=>console.error('F/L表示エラー',e));document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(render,0));watchPayroll();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,800));else setTimeout(boot,800);
  window.__TSUBASA_FL_DIRECT__='2026-08-17-benchmark';
})();