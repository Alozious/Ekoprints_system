import InfoTooltip from './InfoTooltip';
import React from 'react';
import type { Expense, Sale, StockTransaction } from '../types';
import { profitSummary } from '../reportAccounting';
import type { AccountingFilter, DepartmentFilter } from '../reportAccounting';
const money = (value: number) => `${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(value)} UGX`;
export default function ProfitReport({ sales, expenses, stockTransactions, filter, module = 'all' }: { sales: Sale[]; expenses: Expense[]; stockTransactions: StockTransaction[]; filter: AccountingFilter; module?: DepartmentFilter }) {
  const totals = profitSummary(sales, expenses, stockTransactions, filter, module);
  return <section className="bg-white rounded-3xl p-5 border border-gray-100 space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-black text-gray-900">Cash collected, COGS and profit</h3><InfoTooltip label="Profit calculations">    <p className="text-xs text-gray-200">Gross profit uses cash collected. Net profit deducts operating expenses and net stock adjustments. COGS: started materials {money(totals.startCogs)} + unopened material and product resales {money(totals.resaleCogs)}. Opening balances and purchases are not COGS. Stock adjustment losses reduce profit; gains add to profit.</p>
    {totals.missingCogs > 0 && <p className="text-xs text-amber-300" role="status">{totals.missingCogs} historical sale lines have no recorded COGS. Profit is provisional; missing historical costs have not been invented from current prices.</p>}
    <p className="text-xs text-gray-200">A month with two started rolls can show higher material cost than a month with none.</p></InfoTooltip></div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[
      ['Cash collected', totals.cashCollected], ['COGS', totals.cogs], ['Gross profit', totals.grossProfit],
      ['Operating expenses', totals.operatingExpenses], ['Stock adjustments (net)', totals.adjustments], ['Net profit', totals.netProfit],
    ].map(([label, amount]) => <div key={String(label)} className={`rounded-xl p-3 ${label === 'COGS' ? 'bg-amber-50' : label === 'Net profit' ? 'bg-blue-50' : 'bg-gray-50'}`}><p className="text-xs font-bold text-gray-500">{label}</p><p className="font-black mt-1">{money(Number(amount))}</p></div>)}</div>


  </section>;
}
