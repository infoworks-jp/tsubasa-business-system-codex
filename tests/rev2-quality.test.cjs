const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('pages-rev2/rev2-data.js','utf8');
function fixture(){
 const daily=Array.from({length:28},(_,i)=>({id:'d'+(i+1),business_date:`2026-02-${String(i+1).padStart(2,'0')}`,status:'confirmed',sales_total:0,customer_count:0,notes:'休業'}));
 Object.assign(daily[2],{sales_total:3900,customer_count:2,issued_count:40,settlement_count:-1,settlement_amount:100,notes:'原票照合済み'});
 return {daily_journal:daily,journal_products:Array.from({length:40},(_,i)=>({id:'p'+i,product_id:'p'+i,daily_journal_id:'d3',quantity:i?1:0,issued_count:1,settlement_count:i?0:-1,sales_amount:i?100:0,unit_price:100})),journal_hours:Array.from({length:24},(_,i)=>({id:'h'+i,daily_journal_id:'d3',hour_start:i,quantity:i?0:40,sales_amount:i?0:4000})),documents:[{id:'source',business_date:'2026-02-03',document_type:'journal_source_original',retention_status:'preserved',sha256:'a'.repeat(64),byte_size:100,library_file_id:'example'}],product_master:[],monthly_summary:[]};
}
async function quality(data){
 const window={TSUBASA_CONFIG:{supabaseUrl:'https://example.test',publishableKey:'test',schema:'rev2'}};
 const fetch=async(url,opts)=>{const t=new URL(url).pathname.split('/').at(-1);const [a,b]=opts.headers.Range.split('-').map(Number);return {ok:true,json:async()=>structuredClone((data[t]||[]).slice(a,b+1))}};
 class FixedDate extends Date{static now(){return Date.parse('2026-11-02T00:00:00Z')}};
 vm.runInNewContext(code,{window,fetch,Date:FixedDate});return window.rev2Api('/api/quality/2026-02');
}
test('positive and signed refunds reconcile exactly, without allocating refunds to hours',async()=>{for(const sign of [1,-1]){const f=fixture();f.daily_journal[2].settlement_amount*=sign;const q=await quality(f);assert.equal(q.matched,true);assert.equal(q.hourly_net,3900);assert.equal(q.details[2].hourly_net,3900);}});
test('a missing business date prevents full-month confirmation; Monday remains a planned closure',async()=>{const f=fixture();f.daily_journal=f.daily_journal.filter(d=>!['2026-02-04','2026-02-09'].includes(d.business_date));const q=await quality(f);assert.equal(q.matched,false);assert.deepEqual(Array.from(q.missing_business_dates),['2026-02-04']);assert.deepEqual(Array.from(q.planned_closure_dates),['2026-02-09']);});
test('unallocated multi-day journals cannot become fully confirmed',async()=>{const f=fixture();f.daily_journal[2].notes='【日付配分要確認】';const q=await quality(f);assert.equal(q.matched,false);assert.deepEqual(Array.from(q.unresolved_date_dates),['2026-02-03']);});
test('24 rows alone cannot pass wrong amounts, duplicate hours, missing refunds or wrong quantities',async()=>{for(const change of [f=>f.journal_hours[0].sales_amount++,f=>f.journal_hours[1].hour_start=0,f=>f.daily_journal[2].settlement_amount=null,f=>f.journal_hours[0].quantity--]){const f=fixture();change(f);const q=await quality(f);assert.equal(q.hourly_match,false);assert.equal(q.matched,false);}});
test('40 rows alone cannot pass duplicate products or wrong issue/refund counts',async()=>{for(const change of [f=>f.journal_products[1].product_id='p0',f=>f.journal_products[0].issued_count++,f=>f.journal_products[0].settlement_count=0]){const f=fixture();change(f);const q=await quality(f);assert.equal(q.product_match,false);assert.equal(q.matched,false);}});
