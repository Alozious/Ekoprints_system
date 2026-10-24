import type { AssignedDepartment, Expense, InventoryItem, Sale, StockItem, StockTransaction } from './types.ts';
import { department } from './stockMath.ts';
export type DepartmentFilter = AssignedDepartment | 'all';
export type AccountingPeriod = 'all' | 'year' | 'month' | 'today' | 'yesterday' | 'custom';
export interface AccountingFilter { period: AccountingPeriod; dateMode?: 'specific' | 'range'; start?: string; end?: string; now?: Date }
export const businessDay = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function inPeriod(value: string, filter: AccountingFilter) {
  if (!Number.isFinite(new Date(value).getTime())) return false;
  const day = businessDay(value), today = businessDay(filter.now || new Date());
  if (filter.period === 'all') return true;
  if (filter.period === 'year') return day.slice(0, 4) === today.slice(0, 4);
  if (filter.period === 'month') return day.slice(0, 7) === today.slice(0, 7);
  if (filter.period === 'today') return day === today;
  if (filter.period === 'yesterday') return day === businessDay(new Date(new Date(`${today}T12:00:00+03:00`).getTime() - 86400000));
  return filter.dateMode === 'range' ? day >= (filter.start || '') && day <= (filter.end || '') : day === filter.start;
}
export const saleDepartment = (item: Sale['items'][number]): AssignedDepartment => department(item.module || item.metadata?.tab);
export function moduleShare(sale: Sale, module: DepartmentFilter) {
  if (module === 'all') return 1;
  const gross = sale.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  if (gross === 0) return sale.items.length ? sale.items.filter(i => saleDepartment(i) === module).length / sale.items.length : 0;
  return sale.items.filter(i => saleDepartment(i) === module).reduce((sum, i) => sum + i.quantity * i.price, 0) / gross;
}
export function allocatedSale(sale: Sale, module: DepartmentFilter): Sale {
  const share = moduleShare(sale, module);
  if (module === 'all') return sale;
  return { ...sale, items: sale.items.filter(i => saleDepartment(i) === module), total: sale.total * share,
    subtotal: (sale.subtotal ?? sale.items.reduce((s, i) => s + i.price * i.quantity, 0)) * share,
    discount: (sale.discount || 0) * share, amountPaid: (sale.amountPaid || 0) * share,
    payments: (sale.payments || []).map(p => ({ ...p, amount: p.amount * share })) };
}
export function profitSummary(sales: Sale[], expenses: Expense[], movements: StockTransaction[], filter: AccountingFilter, module: DepartmentFilter = 'all') {
  const includedSales = sales.filter(s => !s.voidedAt && !s.internalComplementary && inPeriod(s.date, filter));
  const includedMovements = movements.filter(t => 'type' in t && inPeriod(t.date, filter) && (module === 'all' || t.module === module));
  const revenue = includedSales.reduce((sum, s) => sum + s.total * moduleShare(s, module), 0);
  const cashCollected = sales.filter(s => !s.voidedAt && !s.internalComplementary).reduce((sum, sale) => {
    const payments = sale.payments?.length ? sale.payments : [{ date: sale.date, amount: sale.amountPaid || 0 }];
    return sum + payments.filter(payment => inPeriod(payment.date, filter)).reduce((paid, payment) => paid + payment.amount * moduleShare(sale, module), 0);
  }, 0);
  const lines = includedSales.flatMap(s => s.items).filter(i => module === 'all' || saleDepartment(i) === module);
  const resaleCogs = lines.reduce((sum, i) => sum + (i.cogsAtSale || 0), 0);
  const startCogs = includedMovements.reduce((sum, t) => sum + ('type' in t && t.type === 'Start' ? t.totalValue : 0), 0);
  const adjustments = includedMovements.reduce((sum, t) => sum + ('type' in t && t.type === 'Adjustment' ? -t.units * t.unitCost : 0), 0);
  const operatingExpenses = expenses.filter(e => inPeriod(e.date, filter) && (module === 'all' || department(e.module) === module)).reduce((sum, e) => sum + e.amount, 0);
  const cogs = startCogs + resaleCogs, grossProfit = cashCollected - cogs;
  // Historical unknown costs remain unknown; do not reconstruct them from today's average.
  const missingCogs = lines.filter(i => i.cogsAtSale === undefined).length;
  return { revenue, cashCollected, startCogs, resaleCogs, cogs, adjustments, operatingExpenses, grossProfit, netProfit: grossProfit - operatingExpenses - adjustments, missingCogs };
}

/** Inventory is a closing asset balance, never the sum of purchases in a period. */
export function inventoryValuation(stock: StockItem[], products: InventoryItem[], movements: StockTransaction[], filter: AccountingFilter, module: DepartmentFilter = 'all') {
  const now = filter.now || new Date();
  const today = businessDay(now);
  let closingDay = today;
  if (filter.period === 'yesterday') closingDay = businessDay(new Date(new Date(`${today}T12:00:00+03:00`).getTime() - 86400000));
  if (filter.period === 'custom') closingDay = (filter.dateMode === 'range' ? filter.end : filter.start) || today;
  if (closingDay > today) closingDay = today;
  const historical = closingDay < today;
  const cutoff = new Date(`${closingDay}T23:59:59.999+03:00`).getTime();
  let missingItems = 0;
  const rows: { name: string; units: number; unit: string; cost: number; value: number }[] = [];
  const all = [
    ...stock.map(item => ({ id: item.id || item.skuId, legacyId: item.skuId, name: item.itemName, module: item.module, entity: 'material', units: item.unitsOnHand, cost: item.avgCostPerUnit, unit: item.unit || 'roll', valid: item.inventoryVersion === 1 })),
    ...products.map(item => ({ id: item.id, legacyId: item.id, name: item.name, module: item.module, entity: 'product', units: item.quantity, cost: item.avgCost ?? item.purchasePrice, unit: 'pcs', valid: !item.costMissing })),
  ];
  for (const item of all.filter(item => module === 'all' || department(item.module) === module)) {
    if (!historical) {
      if (!item.valid || !Number.isFinite(item.units) || !Number.isFinite(item.cost)) { missingItems++; continue; }
      rows.push({ name: item.name, units: item.units!, unit: item.unit, cost: item.cost!, value: item.units! * item.cost! });
      continue;
    }
    const history = movements.filter(t => 'type' in t && t.entity === item.entity && [item.id, item.legacyId].includes(t.skuId) && new Date(t.date).getTime() <= cutoff);
    if (!history.some(t => 'type' in t && t.type === 'Opening')) { missingItems++; continue; }
    const units = history.reduce((sum, t) => sum + ('units' in t ? t.units : 0), 0);
    const value = history.reduce((sum, t) => sum + ('unitCost' in t ? t.units * t.unitCost : 0), 0);
    rows.push({ name: item.name, units, unit: item.unit, cost: units ? value / units : 0, value });
  }
  return { rows, value: rows.reduce((sum, row) => sum + row.value, 0), missingItems, closingDay, historical };
}

