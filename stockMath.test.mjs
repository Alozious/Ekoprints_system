import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiveBalance, startBalance, sellBalance, restoreBalance, reconcile, adjustmentExpense, wholeUnits, department } from './stockMath.ts';

test('receive calculates weighted average including freight without expensing purchase', () => {
  const next = receiveBalance(2, 450000, 3, 500000, 150000);
  assert.equal(next.unitsOnHand, 5);
  assert.equal(next.landedUnitCost, 550000);
  assert.equal(next.avgCostPerUnit, 510000);
});
test('first purchase, free units, and fractional unit costs remain precise', () => {
  assert.equal(receiveBalance(0, 0, 3, 10, 1).avgCostPerUnit, 10 + 1 / 3);
  assert.equal(receiveBalance(2, 100, 2, 0).avgCostPerUnit, 50);
});
test('receives reject zero, negative, fractional, and non-finite inputs', () => {
  for (const qty of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => receiveBalance(0, 0, qty, 100));
  assert.throws(() => receiveBalance(0, 0, 1, -1));
  assert.throws(() => receiveBalance(0, 0, 1, 100, -1));
});
test('starting a roll transfers one whole average cost to COGS', () => {
  const next = startBalance(3, 450000);
  assert.deepEqual(next, { unitsOnHand: 2, unitCost: 450000, totalValue: 450000 });
  assert.equal(next.unitsOnHand * next.unitCost, 900000);
});
test('start blocks insufficient stock; explicit override permits a deficit', () => {
  assert.throws(() => startBalance(0, 450000));
  assert.equal(startBalance(0, 450000, true).unitsOnHand, -1);
  assert.throws(() => startBalance(NaN, 1, true));
  assert.throws(() => startBalance(1, -1));
});
test('reconciliation includes opening counts, purchases, starts, adjustments and resale reversals', () => {
  assert.equal(reconcile(3, 5, 2, -1), 5);
  assert.equal(reconcile(10, 3, 0, 1, 5, 2), 11);
});
test('stock adjustment losses reduce profit, gains add; opening is separate', () => {
  assert.equal(adjustmentExpense(-2, 450000), 900000);
  assert.equal(adjustmentExpense(1, 450000), -450000);
  const sales = 2000000, cogs = 450000, operating = 100000;
  assert.equal(sales - cogs - operating - adjustmentExpense(-1, 450000), 1000000);
});
test('counted unopened units must be supplied explicitly and be whole numbers', () => {
  for (const count of [undefined, NaN, -1, 1.2]) assert.throws(() => wholeUnits(count));
  assert.equal(wholeUnits(0), 0);
});
test('departments are assigned from identifiers, never item names', () => {
  assert.equal(department('dtf'), 'dtf');
  assert.equal(department('DTF print'), 'Unassigned');
  assert.equal(department(undefined), 'Unassigned');
});
test('sale captures cost at issue and blocks negative stock without override', () => {
  assert.deepEqual(sellBalance(10, 12000, 3), { quantity: 7, cogsAtSale: 36000 });
  assert.throws(() => sellBalance(2, 12000, 3));
  assert.equal(sellBalance(2, 12000, 3, true).quantity, -1);
});
test('reversal restores original cost after intervening restock; edit issues at restored average', () => {
  // Two units were sold at 100 each. Current stock after another purchase: 4 at 200.
  const restored = restoreBalance(4, 200, 2, 200);
  assert.equal(restored.quantity, 6);
  assert.equal(restored.avgCost, 1000 / 6);
  const edited = sellBalance(restored.quantity, restored.avgCost, 3);
  assert.equal(edited.quantity, 3);
  assert.equal(edited.cogsAtSale, 500);
});
