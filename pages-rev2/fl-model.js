(function(root){
  'use strict';
  const sum=(rows,key)=>rows.length && rows.every(r=>Number.isFinite(r[key]))?rows.reduce((s,r)=>s+r[key],0):null;
  const rate=(cost,sales)=>Number.isFinite(cost)&&Number.isFinite(sales)&&sales>0?cost/sales:null;
  function build(input,series='historical',basis='salary'){
    const sales=input[series]||[],seen=new Set();
    const purchases=(input.purchases||[]).filter(r=>{if(seen.has(r.key))return false;seen.add(r.key);return true;});
    return input.payroll.map(p=>{
      const matches=sales.filter(s=>s.month===p.month && (series!=='historical'||s.verified));
      const s=matches.length===1?matches[0]:null;
      const parts=purchases.filter(r=>r.month===p.month);
      const salary=Number.isFinite(p.employee)&&Number.isFinite(p.parttime)&&p.employee+p.parttime===p.salary?p.salary:null;
      const labor=basis==='salary'?salary:salary!=null&&p.employer!=null?salary+p.employer:null;
      // No month has complete food coverage or inventory evidence in the audited source.
      const food=null, rent=sum((input.rent||[]).filter(r=>r.month===p.month),'amount');
      return {...p,salary,sales:s?.sales??null,source:s?.source??'この系列の月次確定売上なし',series,basis,labor,food,rent,
        partial:sum(parts,'amount'),partialSources:parts.map(r=>r.source),
        lRate:rate(labor,s?.sales),fRate:rate(food,s?.sales),flRate:null,flrRate:null};
    }).sort((a,b)=>a.month.localeCompare(b.month));
  }
  function aggregate(rows){
    const result={count:rows.length};
    for(const key of ['sales','employee','parttime','salary','employer','labor','food','rent'])result[key]=sum(rows,key);
    result.lRate=rate(result.labor,result.sales);result.fRate=rate(result.food,result.sales);
    result.flRate=result.food!=null&&result.labor!=null?rate(result.food+result.labor,result.sales):null;
    return result;
  }
  function compare(rows){
    if(rows.length<2)return null;
    const sorted=[...rows].sort((a,b)=>a.month.localeCompare(b.month)),first=sorted[0],last=sorted.at(-1);
    if(!sorted.every(r=>r.sales>0&&r.salary!=null&&r.series===first.series))return null;
    return {first,last,payChange:last.salary-first.salary,salesChange:last.sales-first.sales,
      rateChange:last.salary/last.sales-first.salary/first.sales,
      payEffect:(last.salary-first.salary)/first.sales,
      salesEffect:last.salary/last.sales-last.salary/first.sales};
  }
  function sort(rows,key,direction){
    return [...rows].sort((a,b)=>{const x=a[key],y=b[key];if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*direction;});
  }
  const model={build,aggregate,compare,sort,rate};
  if(typeof module!=='undefined')module.exports=model;else root.TsubasaFLModel=model;
})(typeof window==='undefined'?globalThis:window);
