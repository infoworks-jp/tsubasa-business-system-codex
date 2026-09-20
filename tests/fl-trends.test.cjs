// Run: node tests/fl-trends.test.cjs
// Payroll/monthly sales below are aggregate source-verification fixtures.
// Expenses and rent are deliberately PARTIAL fixtures, not a complete ledger.
const assert = require('node:assert/strict');
const {model, totals, compare, foodCategory} = require('../pages-rev2/fl-trends.js');
const employees = [1606818,1600000,1340000,1355000,1297000,1292000,1114000,1375000];
const parttime = [818253,939395,944970,639426,571322,422546,532685,468502];
const historical = [4659260,6229990,5256460,3590555,4749577,5560344,5028262,5254100];
const month = i => `2026-${String(i+1).padStart(2,'0')}-01`;
const raw = {
  payroll: employees.map((v,i) => ({payroll_month:month(i),employee_gross:v,parttime_gross:parttime[i],gross_pay:v+parttime[i],employer_cost:[5,6].includes(i)?314440:null,employer_cost_included:false,status:i===7?'原票同名行・要確認':'確定'})),
  historical_monthly_performance: historical.map((v,i) => ({month_start:month(i),sales_total:v})),
  monthly_summary: [4995250,4917050,5050830].map((v,i) => ({month_start:month(i+5),sales_total:v,is_canonical:true,status:'confirmed'})),
  expenses: [
    {expense_date:month(4),category:'麺仕入',amount:237584,status:'confirmed',is_canonical:true},
    {expense_date:month(4),category:'餃子仕入',amount:56700,status:'confirmed',is_canonical:true},
    {expense_date:month(5),category:'麺・餃子仕入',amount:294284,status:'confirmed',is_canonical:false}
  ],
  bank_transactions: [
    {transaction_date:month(5),withdrawal_amount:294284,estimated_category:'麺・餃子仕入',match_status:'matched'},
    {transaction_date:month(5),withdrawal_amount:541957,estimated_category:'店舗固定費',match_status:'matched'}
  ],
  monthly_operating_costs: [{month_start:month(7),cost_type:'rent',amount:338112,verification_status:'confirmed'}]
};
const h=model(raw,'historical'),t=model(raw,'ticket');
assert.equal(h.length,8);assert.ok(h.every(r=>r.salaryOK));
assert.equal(h[7].salary,1843502);assert.equal(h[7].pending,true);
assert.equal(h[4].accrued,294284);assert.equal(h[5].foodPaid,294284);
assert.equal(h[0].foodPaid,null);assert.ok(h.every(r=>r.fl===null&&r.labor===null));
assert.equal(h[5].employerRegistered,314440);assert.equal(h[5].labor,null);
assert.equal(h[7].rent,338112);assert.equal(h[7].flr,null);
assert.equal(t[0].sales,null);assert.equal(t[7].sales,5050830);
assert.equal(totals(t).salaryRate,null);assert.equal(t[7].salaryRate,1843502/5050830);
const c=compare(h);assert.equal(Math.round(c.saving),681568);
assert.equal(c.first.length,3);assert.equal(c.last.length,3);
assert.equal(totals(h).salary,16316917);
assert.equal(totals(h).salaryRate,16316917/historical.reduce((s,v)=>s+v,0));
assert.ok(foodCategory('酒類・飲料仕入'));assert.ok(!foodCategory('賃貸家賃'));assert.ok(!foodCategory('仕入・外注支払'));
const bad=structuredClone(raw);bad.payroll[0].gross_pay=0;
assert.equal(model(bad,'historical')[0].salaryOK,false);assert.equal(model(bad,'historical')[0].salaryRate,null);
const duplicate=structuredClone(raw);duplicate.payroll.push(raw.payroll[0]);assert.throws(()=>model(duplicate,'historical'));
// Synthetic future complete-cost scenario; never upload these example costs to DB.
const complete=structuredClone(raw);complete.monthly_operating_costs.push(
  {month_start:month(7),cost_type:'food_cost_total',amount:1500000,verification_status:'confirmed'},
  {month_start:month(7),cost_type:'employer_labor_cost_total',amount:100000,verification_status:'confirmed'}
);
const full=model(complete,'ticket');assert.equal(full[7].labor,1943502);assert.equal(full[7].fl,3443502);assert.equal(full[7].flr,3781614);
complete.payroll[7].employer_cost_included=true;assert.equal(model(complete,'ticket')[7].labor,1843502);
console.log('PASS: 31 source-aware payroll/FL regression assertions');
