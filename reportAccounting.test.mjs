import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocatedSale, inPeriod, inventoryValuation, moduleShare, profitSummary } from './reportAccounting.ts';
const date = '2026-10-22T10:00:00Z';
const sale = { id: 's', date, total: 972000, amountPaid: 972000, subtotal: 1000000, discount: 100000, taxPercent: 8, items: [
  { name: 'DTF print banner', quantity: 1, price: 750000, module: 'dtf', cogsAtSale: 0 },
  { name: 'Unopened roll', quantity: 1, price: 250000, module: 'large-format', cogsAtSale: 120000, materialSkuId: 'roll' },
] };
const movement = (type, units, unitCost, module = 'large-format') => ({ transactionId: type, skuId: 'roll', entity: 'material', type, units, unitCost, totalValue: Math.abs(units) * unitCost, module, date });
test('COGS includes Start and resale snapshot, never Opening, Purchase or duplicate Sale movements', () => {
  const result = profitSummary([sale], [], [movement('Opening', 3, 450000), movement('Purchase', 2, 500000), movement('Start', -1, 450000), movement('Sale', -1, 120000)], { period: 'all' });
  assert.equal(result.cogs, 570000); assert.equal(result.grossProfit, 402000);
});
test('department revenue preserves invoice discount and tax and uses stored modules', () => {
  assert.equal(moduleShare(sale, 'dtf'), .75);
  assert.equal(allocatedSale(sale, 'dtf').total, 729000);
  assert.equal(allocatedSale(sale, 'dtf').discount, 75000);
  assert.equal(profitSummary([sale], [], [], { period: 'all' }, 'dtf').cogs, 0);
  assert.equal(profitSummary([sale], [], [], { period: 'all' }, 'large-format').revenue, 243000);
});
test('adjustment losses and gains are separate from COGS; voids do not contribute resale COGS', () => {
  const result = profitSummary([sale, { ...sale, voidedAt: date }], [{ date, amount: 20000, module: 'large-format' }], [movement('Adjustment', -1, 10000), movement('Adjustment', 1, 3000)], { period: 'all' });
  assert.equal(result.adjustments, 7000); assert.equal(result.cogs, 120000); assert.equal(result.netProfit, 825000);
});
test('period dates follow Uganda time and unknown historical costs remain flagged', () => {
  assert.equal(inPeriod('2026-10-21T22:00:00Z', { period: 'today', now: new Date(date) }), true);
  assert.equal(inPeriod('2026-10-21T20:00:00Z', { period: 'today', now: new Date(date) }), false);
  assert.equal(profitSummary([{ ...sale, items: [{ name: 'Old line', quantity: 1, price: 1 }] }], [], [], { period: 'all' }).missingCogs, 1);
});
test('gross/net profit use cash actually collected, including later receipts on older invoices', () => {
  const older = { ...sale, date: '2026-09-01', amountPaid: 600000, payments: [
    { date: '2026-09-01', amount: 100000 }, { date: '2026-10-22', amount: 500000 },
  ] };
  const filter = { period: 'custom', dateMode: 'specific', start: '2026-10-22' };
  const result = profitSummary([older, { ...sale, amountPaid: 0 }], [{date,amount:10000,module:'dtf'}], [movement('Start',-1,20000,'dtf')], filter, 'dtf');
  assert.equal(result.cashCollected,375000); // DTF has 75% of the mixed invoice.
  assert.equal(result.revenue,729000); // Unpaid invoicing does not inflate profit.
  assert.equal(result.grossProfit,355000);
  assert.equal(result.netProfit,345000);
});
test('closing inventory follows department and historical cutoff, rather than purchase totals', () => {
  const item = { id:'r',skuId:'r',module:'large-format',itemName:'Roll',inventoryVersion:1,unitsOnHand:3,avgCostPerUnit:125,unit:'roll' };
  const records = [
    { ...movement('Opening',3,100),skuId:'r',date:'2026-10-01' },
    { ...movement('Purchase',1,200),skuId:'r',date:'2026-10-10' },
    { ...movement('Start',-1,125),skuId:'r',date:'2026-10-20' },
  ];
  const past = inventoryValuation([item],[],records,{period:'custom',dateMode:'range',start:'2026-10-01',end:'2026-10-15',now:new Date(date)},'large-format');
  assert.equal(past.value,500); assert.equal(past.rows[0].units,4);
  assert.equal(inventoryValuation([item],[],records,{period:'today',now:new Date(date)},'large-format').value,375);
  assert.equal(inventoryValuation([item],[],records,{period:'all',now:new Date(date)},'dtf').value,0);
});
test('historical inventory before known opening is excluded and flagged, never invented', () => {
  const result = inventoryValuation([{skuId:'r',module:'dtf',itemName:'Film',inventoryVersion:1,unitsOnHand:2,avgCostPerUnit:500}],[],[],{period:'custom',start:'2026-09-01',now:new Date(date)});
  assert.equal(result.missingItems,1); assert.equal(result.value,0);
});
