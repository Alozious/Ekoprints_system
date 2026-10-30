import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementHtml } from './statementExport.ts';
const sale = { id: 'invoice-1', date: '2026-10-20T22:00:00Z', total: 100, amountPaid: 60, items: [{ name: '<script>bad</script>', quantity: 1, price: 100, module: 'dtf', cogsAtSale: 10 }], payments: [{ date: '2026-10-20T22:00:00Z', amount: 20 }, { date: '2026-10-22T10:00:00Z', amount: 40 }] };
const input = { sales: [sale], expenses: [], stockTransactions: [], inventory: [], stockItems: [], customers: [], bankingRecords: [], filter: { period: 'all' }, module: 'all', admin: true, businessName: 'Test & Co', header: 'Test', footer: '', userName: 'Admin', periodLabel: 'All time' };
test('statement matches financial cards, groups by Uganda day and ends each day with totals and separator', () => {
  const html = statementHtml(input);
  assert.equal((html.match(/class="day-summary"/g) || []).length, 2);
  assert.equal((html.match(/class="separator"/g) || []).length, 2);
  assert.ok(html.includes('Daily summary · 2026-10-21'));
  assert.ok(html.includes('Daily summary · 2026-10-22'));
  for (const label of ['Total invoiced', 'Cash collected', 'Outstanding debts', 'Cost of goods (COGS)', 'Gross profit', 'Operating expenses', 'Net profit', 'Inventory value']) assert.ok(html.includes(label));
  assert.ok(html.includes('40 UGX'));
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
});
test('statement filters payment dates separately from invoice dates and hides confidential fields for staff', () => {
  const html = statementHtml({ ...input, admin: false, module: 'dtf', filter: { period: 'custom', start: '2026-10-22', dateMode: 'specific' } });
  assert.ok(html.includes('40 UGX'));
  assert.ok(!html.includes('class="day-heading"><th colspan="5">2026-10-21'));
  assert.ok(!html.includes('Gross profit'));
  assert.ok(!html.includes('Resale COGS'));
  assert.ok(!html.includes('Inventory value'));
  assert.ok(!statementHtml({ ...input, module: 'embroidery' }).includes('invoice-1'));
});

test('setup openings and superseded zero movements do not become dated business transactions', () => {
  const movement = { skuId: 'roll', entity: 'material', module: 'large-format', date: '2026-10-22T22:00:00Z', unitCost: 0, totalValue: 0 };
  const html = statementHtml({ ...input, sales: [], stockTransactions: [
    { ...movement, type: 'Opening', transactionId: 'setup-opening', units: 1 },
    { ...movement, type: 'Adjustment', transactionId: 'migration-count', units: 1, notes: 'Admin confirmed unopened-unit count during migration; existing Opening retained.' },
    { ...movement, type: 'Purchase', transactionId: 'superseded', units: 0 },
  ] });
  assert.ok(!html.includes('setup-opening'));
  assert.ok(!html.includes('migration-count'));
  assert.ok(!html.includes('superseded'));
  assert.ok(!html.includes('class="day-heading"'));
});

test('historical purchases and starts use business dates, names and estimate labels; date-only expenses invent no time', () => {
  const base = { skuId: 'roll', entity: 'material', module: 'large-format', unitCost: 250000, totalValue: 250000, dateEstimated: true, recordedAt: '2026-10-23T10:00:00Z' };
  const html = statementHtml({ ...input, sales: [], stockItems: [{ id: 'roll', itemName: 'Pullup 1.24 m' }], expenses: [{ date: '2025-12-13', category: 'Transport', description: 'Materials', amount: 20000 }], stockTransactions: [
    { ...base, date: '2025-12-13T08:30:00Z', type: 'Purchase', units: 1, transactionId: 'historical-purchase' },
    { ...base, date: '2025-12-13T08:50:00Z', type: 'Start', units: -1, transactionId: 'historical-start' },
  ] });
  assert.ok(html.includes('Daily summary · 2025-12-13'));
  assert.ok(!html.includes('Daily summary · 2026-10-23'));
  assert.ok(html.includes('Pullup 1.24 m'));
  assert.ok(html.includes('estimated date/time'));
  assert.ok(html.includes('11:30'));
  assert.ok(html.includes('Not recorded'));
  assert.ok(html.includes('Started material COGS'));
});

test('monthly/yearly grouping respects custom bounds and selected cards and particulars', () => {
  const options = { grouping:'monthly',cards:['Cash collected'],cashFlow:[],particulars:['Payments'] };
  const html = statementHtml({...input,options,filter:{period:'custom',dateMode:'range',start:'2026-10-22',end:'2026-10-22'}});
  assert.equal((html.match(/class="period-summary"/g)||[]).length,1);
  assert.ok(html.includes('<th scope="row">2026-10</th>'));
  assert.ok(html.includes('2026-10-22 13:00'));
  assert.ok(!html.includes('Total invoiced'));
  assert.ok(!html.includes('Resale COGS'));
  assert.ok(!html.includes('Total banked'));
  assert.ok(html.includes('<td class="amount">40 UGX</td>'));
  const yearly=statementHtml({...input,options:{...options,grouping:'yearly'}});
  assert.ok(yearly.includes('<th scope="row">2026</th>'));
  assert.equal((yearly.match(/class="period-summary"/g)||[]).length,1);
});

test('summary-only cash-flow fields use opening and closing balances, independent of particulars', () => {
  const html=statementHtml({...input,options:{grouping:'daily',cards:[],cashFlow:['Cash from yesterday','Money banked','Money in safe'],particulars:[]},expenses:[{date:'2026-10-22',amount:5}],bankingRecords:[{date:'2026-10-22',amount:10}],filter:{period:'custom',dateMode:'range',start:'2026-10-22',end:'2026-10-22'}});
  assert.ok(html.includes('<th scope="col">Cash from yesterday</th>'));
  assert.ok(html.includes('<td class="amount">20 UGX</td><td class="amount">10 UGX</td><td class="amount">45 UGX</td>'));
  assert.ok(!html.includes('Total invoiced'));
  assert.ok(!html.includes('class="day-heading"'));
  assert.ok(!html.includes('class="card"'));
  assert.ok(html.includes('size:A4 landscape'));
});

test('daily table includes empty days and particulars follow their own period summary',()=>{
  const html=statementHtml({...input,options:{grouping:'daily',cards:['Cash collected'],cashFlow:[],particulars:['Payments']},filter:{period:'custom',dateMode:'range',start:'2026-10-21',end:'2026-10-23'}});
  assert.equal((html.match(/class="period-summary"/g)||[]).length,3);
  const first=html.indexOf('<th scope="row">2026-10-22</th>'),details=html.indexOf('Transaction particulars · 2026-10-22'),second=html.indexOf('<th scope="row">2026-10-21</th>');
  assert.ok(first<details&&details<second);
  assert.ok(html.includes('<td class="amount">0 UGX</td>'));
});

test('Kuyiriba direct costs are included once in statement COGS',()=>{
 const custom={...sale,items:[{itemId:'shirt',name:'Custom shirt',quantity:2,price:15000,module:'dtf',directCosts:{buyingPrice:7000,otherCost:1000,otherDescription:'Transport'},cogsAtSale:16000}],total:30000};
 const html=statementHtml({...input,sales:[custom]});
 assert.ok(html.includes('Order COGS'));assert.ok(html.includes('16,000 UGX'));assert.ok(!html.includes('Resale COGS'));
});

test('linked internal complementary entries are excluded from external statement transactions',()=>{
const html=statementHtml({...input,sales:[sale,{...sale,id:'internal-complementary',internalComplementary:true,total:5000}]});
assert.ok(html.includes('invoice-1'));assert.ok(!html.includes('internal-complementary'));
});

test('full-year daily statement retains thousands of particulars and every summary day',()=>{
 const expenses=Array.from({length:5000},(_,i)=>({id:'e'+i,date:new Date(Date.UTC(2026,0,1+i%365,10)).toISOString(),category:'Cleaning',description:'Expense-'+i,amount:5000}));
 const html=statementHtml({...input,sales:[],expenses,filter:{period:'custom',dateMode:'range',start:'2026-01-01',end:'2026-12-31'},options:{grouping:'daily',cards:['Operating expenses'],cashFlow:[],particulars:['Expenses']}});
 assert.equal((html.match(/class="period-summary"/g)||[]).length,365);
 assert.equal((html.match(/Cleaning: Expense-/g)||[]).length,5000);
 assert.ok(html.includes('2026-12-31'));
});

test('daily, monthly and yearly statements list recent summaries and particulars first',()=>{
 const expenses=[{date:'2025-01-01T10:00:00Z',category:'Test',description:'old-entry',amount:1},{date:'2026-02-02T09:00:00Z',category:'Test',description:'morning-entry',amount:2},{date:'2026-02-02T15:00:00Z',category:'Test',description:'recent-entry',amount:3}];
 for(const grouping of ['daily','monthly','yearly']){
 const html=statementHtml({...input,sales:[],expenses,filter:{period:'custom',dateMode:'range',start:'2025-01-01',end:'2026-02-02'},options:{grouping,cards:['Operating expenses'],cashFlow:[],particulars:['Expenses']}});
 const periodKeys=[...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(m=>m[1]);
 assert.deepEqual(periodKeys,[...periodKeys].sort().reverse());
 assert.ok(html.indexOf('recent-entry')<html.indexOf('morning-entry'));
 assert.ok(html.indexOf('morning-entry')<html.indexOf('old-entry'));
 }
 const legacy=statementHtml({...input,sales:[],expenses});
 assert.ok(legacy.indexOf('recent-entry')<legacy.indexOf('old-entry'));
});

test('statement opens with four printable graphs before transaction summaries',()=>{
 const html=statementHtml({...input,options:{grouping:'monthly',cards:['Cash collected'],cashFlow:[],particulars:['Payments']}});
 assert.equal((html.match(/<svg /g)||[]).length,4);
 assert.ok(html.indexOf('class="chart-cover"')<html.indexOf('<table class="summary-table">'));
 assert.ok(html.includes('break-after:page'));
 for(const title of ['Collections against costs','Largest operating expenses','Top selling items','Department performance'])assert.ok(html.includes(title));
 assert.ok(!/adjustment/i.test(html));
 const staff=statementHtml({...input,admin:false});assert.ok(!staff.includes('Net profit / loss'));assert.ok(!staff.includes('COGS'));
});
