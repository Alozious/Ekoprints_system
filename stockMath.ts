import type { AssignedDepartment, Department } from './types.ts';

export function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`);
  return value;
}
export function positive(value: number, label: string): number {
  nonNegative(value, label);
  if (value === 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}
export function wholeUnits(value: number): number {
  nonNegative(value, 'Units');
  if (!Number.isSafeInteger(value)) throw new Error('Unopened units must be whole numbers.');
  return value;
}
export function department(value: string | undefined): AssignedDepartment {
  const departments: Department[] = ['large-format', 'dtf', 'embroidery', 'bizhub', 'supplies', 'products'];
  return departments.includes(value as Department) ? value as Department : 'Unassigned';
}
export function receiveBalance(oldUnits: number, oldAvg: number, units: number, unitCost: number, freight = 0) {
  nonNegative(oldUnits, 'Existing units'); nonNegative(oldAvg, 'Existing cost');
  positive(wholeUnits(units), 'Units'); nonNegative(unitCost, 'Unit cost'); nonNegative(freight, 'Freight');
  const landedUnitCost = unitCost + freight / units;
  return { unitsOnHand: oldUnits + units, avgCostPerUnit: (oldUnits * oldAvg + units * landedUnitCost) / (oldUnits + units), landedUnitCost };
}
export function startBalance(units: number, avgCost: number, override = false) {
  if (!Number.isFinite(units)) throw new Error('Invalid balance.');
  nonNegative(avgCost, 'Average cost');
  if (units < 1 && !override) throw new Error('No unopened unit available.');
  return { unitsOnHand: units - 1, unitCost: avgCost, totalValue: avgCost };
}
export function sellBalance(units: number, avgCost: number, sold: number, override = false) {
  if (!Number.isFinite(units)) throw new Error('Invalid product balance.');
  positive(wholeUnits(sold), 'Sale quantity'); nonNegative(avgCost, 'Product cost');
  if (units - sold < 0 && !override) throw new Error('Insufficient resale stock.');
  return { quantity: units - sold, cogsAtSale: sold * avgCost };
}
export function restoreBalance(units: number, avgCost: number, restored: number, originalCogs: number) {
  positive(wholeUnits(restored), 'Original quantity'); nonNegative(originalCogs, 'Original COGS');
  if (!Number.isFinite(units)) throw new Error('Invalid product balance.');
  nonNegative(avgCost, 'Current cost');
  const quantity = units + restored;
  return { quantity, avgCost: quantity > 0 ? (units * avgCost + originalCogs) / quantity : originalCogs / restored };
}
export function reconcile(opening: number, purchases: number, started: number, adjustments: number, sold = 0, reversals = 0) {
  if (![opening, purchases, started, adjustments, sold, reversals].every(Number.isFinite)) throw new Error('Invalid reconciliation values.');
  return opening + purchases - started + adjustments - sold + reversals;
}
/** Positive amount is an expense (loss); negative amount is a gain. Opening is excluded. */
export function adjustmentExpense(units: number, unitCost: number) {
  return -units * nonNegative(unitCost, 'Cost');
}
