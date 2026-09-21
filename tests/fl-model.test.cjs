const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../pages-rev2/fl-model.js');
const payroll=Array.from({length:8},(_,i)=>({month:`2026-0${i+1}`,employee:1000-i*50,parttime:400,salary:1400-i*50,employer:null,employerRecorded:i===5?300:null,corrected:i===7}));
const input={payroll,historical:payroll.map((p,i)=>({month:p.month,sales:3000+i*100,verified:true,source:'fixture'})),ticket:payroll.slice(5).map(p=>({month:p.month,sales:2800,source:'fixture'})),purchases:[{key:'one',month:'2026-05',amount:40},{key:'one',month:'2026-05',amount:40}],rent:[]};
test('eight months reconcile salary and retain correction marker',()=>{const r=M.build(input);assert.equal(r.length,8);assert.ok(r.every(x=>x.employee+x.parttime===x.salary));assert.equal(r[7].corrected,true);});
test('unverified employer cost is never zero or added',()=>{const r=M.build(input,'historical','total');assert.ok(r.every(x=>x.labor===null&&x.lRate===null));assert.equal(M.aggregate(r).labor,null);});
test('partial purchases deduplicate and never become actual F/FL',()=>{const r=M.build(input);assert.equal(r[4].partial,40);assert.ok(r.every(x=>x.food===null&&x.flRate===null&&x.fRate===null));});
test('series switch changes denominator without fallback',()=>{const r=M.build(input,'ticket');assert.equal(r[0].sales,null);assert.equal(r[5].lRate,payroll[5].salary/2800);assert.equal(M.aggregate(r).lRate,null);assert.equal(M.compare(r),null);assert.ok(M.compare(r.slice(5)));});
test('period aggregate is ratio of totals',()=>{const r=M.build(input).slice(1,6),a=M.aggregate(r);assert.equal(a.lRate,r.reduce((s,x)=>s+x.salary,0)/r.reduce((s,x)=>s+x.sales,0));assert.notEqual(a.lRate,r.reduce((s,x)=>s+x.lRate,0)/r.length);});
test('nulls remain last in either direction and zero remains valid',()=>{for(const dir of [1,-1])assert.equal(M.sort([{sales:null},{sales:0},{sales:2}],'sales',dir).at(-1).sales,null);});
test('decomposition sums to total rate change',()=>{const c=M.compare(M.build(input));assert.ok(Math.abs(c.payEffect+c.salesEffect-c.rateChange)<1e-12);});
test('missing salary component and duplicate sales fail closed',()=>{const changed=structuredClone(input);changed.payroll[0].employee=null;changed.historical.push(changed.historical[1]);const r=M.build(changed);assert.equal(r[0].salary,null);assert.equal(r[1].sales,null);assert.equal(M.aggregate(r).lRate,null);});
test('empty period and single month cannot imply improvement',()=>{assert.equal(M.aggregate([]).salary,null);assert.equal(M.compare(M.build(input).slice(0,1)),null);});
const evidence={version:1,payroll_month:'2026-04',insurance_month:'2026-04',scope_verified:true,month_verified:true,deduction_verified:true,coverage:'social_only_before_adjustments',employee_social_deduction:125506,employee_employment_deduction:6595,payment_id:'payment',payment_date:'2026-05-29',payment_amount:314440,employer_difference:188934,source_sheet:'8.4'};
const bank=[{id:'payment',transaction_date:'2026-05-29',withdrawal_amount:314440,source_reference:'fixture'}];
test('social remittance subtracts M only, not M+N; maps payment to premium month',()=>{
 const r=M.reconcileInsurance('2026-04',evidence,bank,[evidence]);assert.equal(r.employer,188934);assert.equal(r.employeeEmployment,6595);assert.equal(r.paymentDate,'2026-05-29');
 assert.equal(M.reconcileInsurance('2026-05',evidence,bank).employer,null);
});
test('missing evidence, missing bank, changed amount/date and duplicate allocations stay unknown',()=>{
 for(const patch of [{version:2},{scope_verified:false},{month_verified:false},{deduction_verified:false},{employee_social_deduction:null},{employee_social_deduction:400000},{employer_difference:0},{insurance_month:'2026-05'}])assert.equal(M.reconcileInsurance('2026-04',{...evidence,...patch},bank).employer,null);
 for(const rows of [[],[...bank,...bank],[{...bank[0],withdrawal_amount:300000}],[{...bank[0],transaction_date:'2026-06-30'}]])assert.equal(M.reconcileInsurance('2026-04',evidence,rows).employer,null);
 assert.equal(M.reconcileInsurance('2026-04',evidence,bank,[evidence,{...evidence,payroll_month:'2026-05'}]).employer,null);
 assert.equal(M.reconcileInsurance('2026-04',null,bank).employer,null);
});
test('a reconciled zero stays zero, a missing value never becomes zero',()=>{
 assert.equal(M.reconcileInsurance('2026-04',{...evidence,employee_social_deduction:314440,employer_difference:0},bank).employer,0);
 assert.equal(M.reconcileInsurance('2026-04',{...evidence,employee_social_deduction:null},bank).employer,null);
});
test('social basis adds only matched share, incomplete months and full employer costs stay unknown',()=>{
 const data=structuredClone(input);data.payroll.forEach((p,i)=>p.employer=i>=3&&i<=5?188934:null);
 const rows=M.build(data,'historical','social');assert.equal(rows[3].labor,data.payroll[3].salary+188934);assert.equal(rows[6].labor,null);
 const period=rows.slice(3,6);assert.equal(M.aggregate(period).lRate,period.reduce((s,r)=>s+r.labor,0)/period.reduce((s,r)=>s+r.sales,0));
 assert.equal(M.aggregate(rows).lRate,null);assert.ok(M.build(data,'historical','total').every(r=>r.labor===null));
 assert.ok(rows.every(r=>r.flRate===null));
});
