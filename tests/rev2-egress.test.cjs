const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('pages-rev2/rev2-data.js','utf8');
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
function setup({store=storage(),now=1000000,fail=false,productCount=1001}={}){
 const requests=[];
 const data={daily_journal:[{id:'d',business_date:'2026-06-02',status:'confirmed',sales_total:productCount*100,customer_count:1}],journal_products:Array.from({length:productCount},(_,i)=>({id:String(i),daily_journal_id:'d',product_id:'p',quantity:1,sales_amount:100,unit_price:100})),journal_hours:[{id:'h',daily_journal_id:'d',hour_start:12,quantity:1,sales_amount:100}],product_master:[{id:'p',product_name:'合成商品'}]};
 const window={TSUBASA_CONFIG:{supabaseUrl:'https://example.test',publishableKey:'test',schema:'rev2'},sessionStorage:store};
 const fetch=async(url,opts)=>{requests.push({url,opts});if(fail)throw Error('offline');const table=new URL(url).pathname.split('/').at(-1);const [start,end]=opts.headers.Range.split('-').map(Number);return {ok:true,json:async()=>structuredClone((data[table]||[]).slice(start,end+1))};};
 vm.runInNewContext(code,{window,fetch,Date:class extends Date{static now(){return now}}});
 return {window,requests,store};
}
test('all pages are loaded once, concurrent consumers share work, aggregates preserve values',async()=>{
 const s=setup();const [a,b]=await Promise.all([s.window.rev2Api('/api/products/all'),s.window.rev2Api('/api/overview/all')]);
 assert.equal(a[0].qty,1001);assert.equal(a[0].sales,100100);assert.equal(b.total_sales,100100);
 const product=s.requests.filter(r=>r.url.includes('/journal_products?'));
 assert.equal(product.length,2);assert.equal(product[1].opts.headers.Range,'1000-1999');
 assert.ok(!product[0].url.includes('select=*'));assert.ok(product[0].url.includes('order=id.asc'));
 assert.equal(s.requests.length,12);
});
test('reload within TTL reuses complete snapshot; manual refresh always fetches',async()=>{
 const a=setup();await a.window.rev2Api('/api/bootstrap');const b=setup({store:a.store,now:1000100});
 await b.window.rev2Api('/api/bootstrap');assert.equal(b.requests.length,0);assert.equal(b.window.rev2DataStatus.reused,true);
 await b.window.rev2Api('/api/fl-refresh');await b.window.rev2Api('/api/bootstrap');assert.equal(b.requests.length,12);assert.equal(b.window.rev2DataStatus.reused,false);
});
test('expired, future-dated, malformed and incomplete snapshots never mask fresh data',async()=>{
 for(const mode of ['expired','future','broken','partial']){
  const a=setup();await a.window.rev2Api('/api/bootstrap');const key=[...a.store.map.keys()][0];
  if(mode==='broken')a.store.setItem(key,'{');
  if(mode==='partial'){const x=JSON.parse(a.store.getItem(key));delete x.source.journal_hours;a.store.setItem(key,JSON.stringify(x));}
  const b=setup({store:a.store,now:mode==='expired'?1600000:mode==='future'?999999:1000001});await b.window.rev2Api('/api/bootstrap');assert.equal(b.requests.length,12,mode);
 }
});
test('blocked storage works, failed fetch never persists partial data',async()=>{
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 const a=setup({store:blocked});await a.window.rev2Api('/api/bootstrap');assert.equal(a.requests.length,12);
 const b=setup({fail:true});await assert.rejects(b.window.rev2Api('/api/bootstrap'),/offline/);assert.equal(b.store.map.size,0);
});
test('exact page boundary fetches final empty page without truncation',async()=>{
 const a=setup({productCount:1000});const p=await a.window.rev2Api('/api/products/all');assert.equal(p[0].qty,1000);assert.equal(a.requests.filter(r=>r.url.includes('/journal_products?')).length,2);
});
