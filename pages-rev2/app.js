const SUPABASE_URL='https://spyopczqtxypqjbhylzf.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg';
const routes=[['kpi','ダッシュボード'],['products','商品別'],['abc','ABC'],['weekday','曜日'],['hourly','時間帯'],['monthly','月別'],['consulting','経営コンサル'],['qa','品質検証'],['bank','通帳']];
const yen=new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0});
const num=new Intl.NumberFormat('ja-JP');
const qaKey=(['127.0.0.1','localhost'].includes(location.hostname)&&sessionStorage.getItem('tsubasa_qa_api_key'))||'';
let data=null;
let dashboardScope='2026-07';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function query(table,select='*'){const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`,{headers:{apikey:qaKey||PUBLISHABLE_KEY,Authorization:`Bearer ${qaKey||PUBLISHABLE_KEY}`,'Accept-Profile':'rev2'}});if(r.status===401)throw new Error('公開データの取得権限がありません');if(!r.ok)throw new Error(`${table}: ${r.status}`);return r.json()}
async function load(){const [daily,products,hours,bank,expenses,payroll,documents,master]=await Promise.all([query('daily_journal'),query('journal_products'),query('journal_hours'),query('bank_transactions'),query('expenses'),query('payroll'),query('documents'),query('product_master')]);return analyze({daily,products,hours,bank,expenses,payroll,documents,master})}

function analyze(raw){
 const activeDaily=raw.daily.filter(r=>r.status==='confirmed');const dailyById=new Map(activeDaily.map(r=>[r.id,r]));const master=new Map(raw.master.map(r=>[r.id,r]));
 const productRows=raw.products.filter(r=>r.source_scope==='monthly_confirmed');const pmap=new Map();for(const r of productRows){const p=master.get(r.product_id)||{};const x=pmap.get(r.product_id)||{code:p.product_code||'未登録',name:p.product_name||'商品未登録',category:p.category||'未分類',quantity:0,sales:0};x.quantity+=Number(r.quantity);x.sales+=Number(r.sales_amount);pmap.set(r.product_id,x)}
 const products=[...pmap.values()].sort((a,b)=>b.sales-a.sales);const psum=products.reduce((s,r)=>s+r.sales,0);let cumulative=0;const abc=products.map(r=>{cumulative+=r.sales;const share=psum?cumulative/psum:0;return{...r,share,klass:share<=.7?'A':share<=.9?'B':'C'}});
 const weekdays=['日','月','火','水','木','金','土'].map(name=>({name,sales:0,days:0}));for(const r of activeDaily){const w=new Date(`${r.business_date}T00:00:00Z`).getUTCDay();weekdays[w].sales+=Number(r.sales_total);if(Number(r.sales_total)>0)weekdays[w].days++}
 const hourly=Array.from({length:24},(_,hour)=>({hour,quantity:0,sales:0}));for(const r of raw.hours){hourly[r.hour_start].quantity+=Number(r.quantity);hourly[r.hour_start].sales+=Number(r.sales_amount)}
 const months=new Map();const month=k=>{if(!months.has(k))months.set(k,{month:k,sales:0,days:0,customers:0,products:0,hours:0,expenses:0,payroll:null});return months.get(k)};for(const r of activeDaily){const x=month(r.business_date.slice(0,7));x.sales+=Number(r.sales_total);x.customers+=Number(r.customer_count||0);if(Number(r.sales_total)>0)x.days++}for(const r of productRows)month(r.period_month.slice(0,7)).products+=Number(r.sales_amount);for(const r of raw.hours){const d=dailyById.get(r.daily_journal_id);if(d)month(d.business_date.slice(0,7)).hours+=Number(r.sales_amount)}for(const r of raw.bank.filter(r=>Number(r.withdrawal_amount)>0&&r.match_status==='matched'))month(r.transaction_date.slice(0,7)).expenses+=Number(r.withdrawal_amount);for(const r of raw.payroll)month(r.payroll_month.slice(0,7)).payroll=r.employer_cost==null?null:Number(r.employer_cost);
 const duplicates=productRows.length-new Set(productRows.map(r=>`${r.period_month}|${r.product_id}|${r.unit_price}`)).size;const failedOcr=raw.documents.filter(r=>r.ocr_status==='failed').length;const unmatched=raw.bank.filter(r=>r.match_status!=='matched').length;
 const monthChecks=[...months.values()].filter(m=>m.products>0).map(m=>({...m,ok:m.sales===m.products}));const hourChecks=[...new Set(raw.hours.map(r=>r.daily_journal_id))].map(id=>{const d=dailyById.get(id);const gross=raw.hours.filter(r=>r.daily_journal_id===id).reduce((s,r)=>s+Number(r.sales_amount),0);const expected=Number(d?.sales_total||0);const settlement=Number(d?.settlement_amount||0);return{date:d?.business_date||'',daily:expected,gross,settlement,ok:gross+settlement===expected}});
 const weekdayOk=weekdays.reduce((s,r)=>s+r.sales,0)===activeDaily.reduce((s,r)=>s+Number(r.sales_total),0);const abcOk=abc.reduce((s,r)=>s+r.sales,0)===psum;const failures=duplicates+failedOcr+unmatched+monthChecks.filter(r=>!r.ok).length+hourChecks.filter(r=>!r.ok).length+(weekdayOk?0:1)+(abcOk?0:1);
 const sales=activeDaily.reduce((s,r)=>s+Number(r.sales_total),0),customers=activeDaily.reduce((s,r)=>s+Number(r.customer_count||0),0);
 return{raw,activeDaily,products,abc,weekdays,hourly,months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)),qa:{duplicates,failedOcr,unmatched,monthChecks,hourChecks,weekdayOk,abcOk,failures},kpi:{sales,customers,days:activeDaily.filter(r=>Number(r.sales_total)>0).length,avg:customers?sales/customers:null}};
}

const table=(headers,rows)=>`<div class="panel table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const metrics=items=>`<div class="metrics">${items.map(([l,v])=>`<div class="metric"><span>${esc(l)}</span><strong>${v}</strong></div>`).join('')}</div>`;

function dashboardRow(d,scope){
 const rows=scope==='all'?d.months.filter(m=>['2026-06','2026-07'].includes(m.month)):d.months.filter(m=>m.month===scope);
 const sales=rows.reduce((s,m)=>s+m.sales,0),days=rows.reduce((s,m)=>s+m.days,0),customers=rows.reduce((s,m)=>s+m.customers,0),expenses=rows.reduce((s,m)=>s+m.expenses,0);
 return{sales,days,customers,expenses,avg:customers?sales/customers:null,daily:days?sales/days:null};
}
function dashboardView(d){
 const x=dashboardRow(d,dashboardScope),summary=['2026-06','2026-07','all'].map(scope=>{const r=dashboardRow(d,scope);return[scope==='all'?'累計':scope.replace('2026-','')+'月',yen.format(r.sales),num.format(r.days)+'日',num.format(r.customers),r.avg==null?'対象外':yen.format(r.avg),r.daily==null?'対象外':yen.format(r.daily)]});
 return `<div class="scope-tabs"><button data-scope="2026-06" class="${dashboardScope==='2026-06'?'active':''}">6月</button><button data-scope="2026-07" class="${dashboardScope==='2026-07'?'active':''}">7月</button><button data-scope="all" class="${dashboardScope==='all'?'active':''}">累計</button></div>`+
 metrics([['売上',yen.format(x.sales)],['営業日',num.format(x.days)+'日'],['客数',num.format(x.customers)],['客単価',x.avg==null?'対象外':yen.format(x.avg)],['1日平均',x.daily==null?'対象外':yen.format(x.daily)],['通帳出金',yen.format(x.expenses)]])+
 `<h2 class="section-title">6月・7月・累計</h2>`+table(['期間','売上','営業日','客数','客単価','1日平均'],summary);
}

function render(){const route=(location.hash.replace('#/','')||'kpi');$('#nav').innerHTML=routes.map(([id,label])=>`<a class="${id===route?'active':''}" href="#/${id}">${label}</a>`).join('');const d=data;let out=`<h1>${esc(routes.find(r=>r[0]===route)?.[1]||'KPI')}</h1>`;
 if(route==='kpi')out+=dashboardView(d);
 if(route==='products')out+=table(['商品コード','商品名','分類','数量','売上'],d.products.map(r=>[esc(r.code),esc(r.name),esc(r.category),num.format(r.quantity),yen.format(r.sales)]));
 if(route==='abc')out+=table(['商品','数量','売上','累計構成比','区分'],d.abc.map(r=>[esc(r.name),num.format(r.quantity),yen.format(r.sales),`${(r.share*100).toFixed(1)}%`,r.klass]));
 if(route==='weekday')out+=table(['曜日','営業日','売上','1日平均'],d.weekdays.map(r=>[r.name,num.format(r.days),yen.format(r.sales),r.days?yen.format(r.sales/r.days):'対象外']));
 if(route==='hourly')out+=`<p class="note">原本がある5営業日の精算前時間帯売上です。</p>`+table(['時間','発行数','売上'],d.hourly.filter(r=>r.quantity||r.sales).map(r=>[`${r.hour}:00`,num.format(r.quantity),yen.format(r.sales)]));
 if(route==='monthly')out+=table(['月','営業日','売上','商品計','時間帯原本計','通帳出金','給与会社負担'],d.months.map(r=>[r.month,num.format(r.days),yen.format(r.sales),r.products?yen.format(r.products):'対象外',r.hours?yen.format(r.hours):'対象外',yen.format(r.expenses),r.payroll==null?'未確定':yen.format(r.payroll)]));
 if(route==='consulting'){const top=d.products[0],wd=[...d.weekdays].filter(r=>r.days).sort((a,b)=>b.sales/b.days-a.sales/a.days)[0],hr=[...d.hourly].sort((a,b)=>b.sales-a.sales)[0];out+=metrics([['売上最大商品',esc(top?.name||'評価不能')],['1日平均最大曜日',esc(wd?.name||'評価不能')],['売上最大時間帯',hr?`${hr.hour}:00`:'評価不能'],['最新集計月',d.months.at(-1)?.month||'評価不能']])+`<p class="note panel">登録済み確定データの最大値だけを表示し、推測値・固定目標・キャッシュは使用していません。</p>`}
 if(route==='qa')out+=metrics([['NG合計',`${d.qa.failures}件`],['商品重複',`${d.qa.duplicates}件`],['OCR失敗',`${d.qa.failedOcr}件`],['通帳未照合',`${d.qa.unmatched}件`],['曜日一致',d.qa.weekdayOk?'OK':'NG'],['ABC一致',d.qa.abcOk?'OK':'NG']])+table(['検査','対象','日別/売上','比較値','判定'],[...d.qa.monthChecks.map(r=>['月別商品一致',r.month,yen.format(r.sales),yen.format(r.products),r.ok?'<span class="ok">OK</span>':'<span class="ng">NG</span>']),...d.qa.hourChecks.map(r=>['時間帯一致',r.date,yen.format(r.daily),`${yen.format(r.gross)} ${r.settlement<0?'-':'+'} ${yen.format(Math.abs(r.settlement))}`,r.ok?'<span class="ok">OK</span>':'<span class="ng">NG</span>'])]);
 if(route==='bank')out+=table(['日付','摘要','入金','出金','分類','照合'],d.raw.bank.map(r=>[r.transaction_date,esc(r.description),yen.format(r.deposit_amount),yen.format(r.withdrawal_amount),esc(r.estimated_category||''),r.match_status==='matched'?'<span class="ok">OK</span>':'<span class="ng">要確認</span>']));
 $('#content').innerHTML=out;
 if(route==='kpi')document.querySelectorAll('[data-scope]').forEach(button=>button.addEventListener('click',()=>{dashboardScope=button.dataset.scope;render()}));
}
async function start(){try{data=await load();render()}catch(e){$('#content').innerHTML=`<div class="error-card">${esc(e.message)}</div>`}}
window.addEventListener('hashchange',()=>data&&render());start();
