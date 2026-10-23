import type { BankingRecord, Customer, Expense, InventoryItem, Sale, StockItem, StockTransaction } from './types.ts';
import { businessDay, inPeriod, inventoryValuation, moduleShare, profitSummary, saleDepartment } from './reportAccounting.ts';
import type { AccountingFilter, DepartmentFilter } from './reportAccounting.ts';
import { department } from './stockMath.ts';

const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => `${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n)} UGX`;
export interface StatementOptions {
  grouping: 'daily' | 'monthly' | 'yearly';
  cards: string[];
  cashFlow: string[];
  particulars: string[];
}
interface StatementInput {
  sales: Sale[]; expenses: Expense[]; stockTransactions: StockTransaction[]; inventory: InventoryItem[]; stockItems: StockItem[];
  customers: Customer[]; bankingRecords: BankingRecord[]; filter: AccountingFilter; module: DepartmentFilter; admin: boolean;
  businessName: string; header: string; footer: string; userName: string; periodLabel: string;
  options?: StatementOptions;
}

export function statementHtml(input: StatementInput) {
  const { sales, expenses, stockTransactions, inventory, stockItems, customers, bankingRecords, filter, module, admin } = input;
  const options = input.options;
  const rows: { date: string; type: string; detail: string; ref: string; amount: number }[] = [];
  const add = (date: string, type: string, detail: string, ref: string, amount: number) => {
    const kind = type === 'Invoice' ? 'Invoices' : type === 'Cash collected' ? 'Payments' : type === 'Operating expense' ? 'Expenses' : type === 'Bank deposit' ? 'Bank deposits' : type.includes('COGS') ? 'COGS' : 'Stock movements';
    if (inPeriod(date, filter) && (!options || options.particulars.includes(kind))) rows.push({ date, type, detail, ref, amount });
  };
  for (const sale of sales.filter(s => !s.voidedAt && moduleShare(s, module) > 0)) {
    const share = moduleShare(sale, module);
    const name = customers.find(c => c.id === sale.customerId)?.name || 'Guest / Walk-in';
    const detail = `${name}: ${sale.items.filter(i => module === 'all' || saleDepartment(i) === module).map(i => `${i.name} × ${i.quantity}`).join(', ')}`;
    add(sale.date, 'Invoice', detail, sale.id, sale.total * share);
    for (const payment of sale.payments?.length ? sale.payments : [{ date: sale.date, amount: sale.amountPaid || 0 }]) {
      if (payment.amount !== 0) add(payment.date, 'Cash collected', name, sale.id, payment.amount * share);
    }
    const resaleCost = sale.items.filter(i => module === 'all' || saleDepartment(i) === module).reduce((sum, i) => sum + (i.cogsAtSale || 0), 0);
    if (admin && resaleCost) add(sale.date, 'Resale COGS', detail, sale.id, resaleCost);
  }
  for (const expense of expenses.filter(e => module === 'all' || department(e.module) === module)) add(expense.date, 'Operating expense', `${expense.category}: ${expense.description}`, 'EXP', expense.amount);
  if (admin) for (const movement of stockTransactions) {
    if (!('type' in movement) || movement.type === 'Sale' || movement.type === 'Opening' || movement.units === 0 ||
      (movement.type === 'Adjustment' && /migration|physical count|existing Opening retained/i.test(movement.notes || '')) ||
      (module !== 'all' && movement.module !== module)) continue;
    const item = movement.entity === 'material'
      ? stockItems.find(s => (s.id || s.skuId) === movement.skuId)
      : inventory.find(i => i.id === movement.skuId);
    const name = item && ('itemName' in item ? item.itemName : item.name) || movement.skuId;
    const estimated = (movement as StockTransaction & { dateEstimated?: boolean; timeEstimated?: boolean }).dateEstimated ||
      (movement as StockTransaction & { timeEstimated?: boolean }).timeEstimated;
    add(movement.date, movement.type === 'Start' ? 'Started material COGS' : `Stock ${movement.type.toLowerCase()}`, `${name} · ${Math.abs(movement.units)} ${movement.entity === 'material' ? 'unit(s)' : 'item(s)'}${estimated ? ' · estimated date/time' : ''}`, movement.transactionId, movement.totalValue);
  }
  // Banking has no department allocation; include only in an all-department statement.
  if (module === 'all') for (const bank of bankingRecords) add(bank.date, 'Bank deposit', `Recorded by ${bank.userName || 'System'}`, 'BANK', bank.amount);
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const cards = (scope: AccountingFilter, format: 'cards' | 'header' | 'row' = 'cards') => {
    const totals = profitSummary(sales, expenses, stockTransactions, scope, module);
    const valuation = inventoryValuation(stockItems, inventory, stockTransactions, scope, module);
    const debts = sales.filter(s => !s.voidedAt && inPeriod(s.date, scope)).reduce((sum, s) => sum + Math.max(0, s.total - (s.amountPaid || 0)) * moduleShare(s, module), 0);
    const values: [string, string][] = [['Total invoiced', money(totals.revenue)], ['Cash collected', money(totals.cashCollected)], ['Outstanding debts', money(debts)]];
    if (admin) values.push(['Cost of goods (COGS)', money(totals.cogs)], ['Gross profit', money(totals.grossProfit)]);
    values.push(['Operating expenses', money(totals.operatingExpenses)]);
    if (admin) values.push(['Net profit', money(totals.netProfit)], ['Inventory value', valuation.missingItems > 0 && !valuation.rows.length ? 'History unavailable' : money(valuation.value)]);
    else values.push(['Net cash flow', money(totals.cashCollected - totals.operatingExpenses)]);
    const selected = values.filter(([label]) => !options || options.cards.includes(label));
    const today = businessDay(filter.now || new Date());
    const first = scope.period === 'custom' ? scope.start! : scope.period === 'today' ? today : scope.period === 'month' ? today.slice(0,7)+'-01' : scope.period === 'year' ? today.slice(0,4)+'-01-01' : '0000-01-01';
    const last = scope.period === 'custom' ? (scope.dateMode === 'range' ? scope.end! : scope.start!) : today;
    const cashAt = (end: string) => sales.filter(s=>!s.voidedAt).reduce((sum,s)=>sum+(s.payments?.length?s.payments:[{date:s.date,amount:s.amountPaid||0}]).filter(p=>businessDay(p.date)<=end).reduce((n,p)=>n+p.amount,0),0)
      - expenses.filter(e=>businessDay(e.date)<=end).reduce((n,e)=>n+e.amount,0) - bankingRecords.filter(b=>businessDay(b.date)<=end).reduce((n,b)=>n+b.amount,0);
    const previous = first === '0000-01-01' ? '' : businessDay(new Date(new Date(first+'T12:00:00+03:00').getTime()-86400000));
    const cashValues: [string,number][] = [['Cash from yesterday',previous?cashAt(previous):0],['Money banked',bankingRecords.filter(b=>inPeriod(b.date,scope)).reduce((n,b)=>n+b.amount,0)],['Money in safe',cashAt(last)]];
    const columns: [string,string][] = [...(module === 'all' ? cashValues.filter(([label])=>options?.cashFlow.includes(label)).map(([label,value])=>[label,money(value)] as [string,string]) : []),...selected];
    if(format==='header') return columns.map(([label])=>`<th scope="col">${escape(label)}</th>`).join('');
    if(format==='row') return columns.map(([,value])=>`<td class="amount">${escape(value)}</td>`).join('');
    const cashHtml = module === 'all' && options?.cashFlow.length ? `<h3>Cash flow · entire business</h3><p>Cash from yesterday is the balance before this period; money in safe is the closing balance.</p><div class="summary">${cashValues.filter(([label])=>options.cashFlow.includes(label)).map(([label,value])=>`<div class="card"><strong>${escape(label)}</strong><span>${money(value)}</span></div>`).join('')}</div>` : '';
    return `${selected.length?`<div class="summary">${selected.map(([label, value]) => `<div class="card"><strong>${escape(label)}</strong><span>${escape(value)}</span></div>`).join('')}</div>`:''}${cashHtml}${admin && selected.length && (totals.missingCogs || valuation.missingItems) ? `<div class="warning">Provisional figures: ${totals.missingCogs} sale lines lack COGS; ${valuation.missingItems} stock records lack usable valuation history and are excluded.</div>` : ''}`;
  };
  const grouping = options?.grouping || 'daily';
  const groupKey = (date: string) => businessDay(date).slice(0, grouping === 'yearly' ? 4 : grouping === 'monthly' ? 7 : 10);
  if(options){
    const today=businessDay(filter.now||new Date());
    const activityDates=[...sales.filter(s=>!s.voidedAt).flatMap(s=>[s.date,...(s.payments||[]).map(p=>p.date)]),...expenses.map(e=>e.date),...bankingRecords.map(b=>b.date),...stockTransactions.filter(t=>'type' in t&&t.type!=='Opening').map(t=>t.date)].filter(d=>Number.isFinite(new Date(d).getTime())).map(businessDay).sort();
    const start=filter.period==='custom'?filter.start!:filter.period==='today'?today:filter.period==='month'?today.slice(0,7)+'-01':filter.period==='year'?today.slice(0,4)+'-01-01':activityDates[0]||today;
    const end=filter.period==='custom'?(filter.dateMode==='range'?filter.end!:filter.start!):today;
    const keys:string[]=[];
    for(let cursor=start;cursor<=end;){const key=cursor.slice(0,grouping==='yearly'?4:grouping==='monthly'?7:10);if(!keys.includes(key))keys.push(key);const date=new Date(cursor+'T12:00:00Z');if(grouping==='yearly'){cursor=String(date.getUTCFullYear()+1)+'-01-01';}else if(grouping==='monthly'){date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);cursor=date.toISOString().slice(0,10);}else{date.setUTCDate(date.getUTCDate()+1);cursor=date.toISOString().slice(0,10);}}
    const headers=cards({...filter,period:'custom',dateMode:'range',start,end},'header');
    const blocks=keys.map(key=>{const first=key.length===4?key+'-01-01':key.length===7?key+'-01':key;const last=key.length===4?key+'-12-31':key.length===7?new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10):key;const scope:AccountingFilter={...filter,period:'custom',dateMode:'range',start:first<start?start:first,end:last>end?end:last};const entries=rows.filter(r=>groupKey(r.date)===key);
      const details=entries.length?`<tr class="particulars"><td colspan="${1+(headers.match(/<th /g)||[]).length}"><table class="details"><caption>Transaction particulars · ${escape(key)}</caption><thead><tr><th>Date / time (Uganda)</th><th>Transaction</th><th>Particulars</th><th>Reference</th><th>Amount (UGX)</th></tr></thead><tbody>${entries.map(r=>`<tr><td>${businessDay(r.date)}${/^\d{4}-\d{2}-\d{2}$/.test(r.date)?' · time not recorded':' '+new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kampala',hour:'2-digit',minute:'2-digit'}).format(new Date(r.date))}</td><td>${escape(r.type)}</td><td>${escape(r.detail)}</td><td>${escape(r.ref)}</td><td class="amount">${money(r.amount)}</td></tr>`).join('')}</tbody></table></td></tr>`:'';
      return `<tbody class="period-group"><tr class="period-summary"><th scope="row">${escape(key)}</th>${cards(scope,'row')}</tr>${details}</tbody>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Statement of Accounts - ${escape(input.businessName)}</title><style>@page{size:A4 landscape;margin:10mm}body{font:10px Arial,sans-serif;color:#1a2232;margin:0}h1{font-size:19px;margin:6px 0}.header,.footer{text-align:center;white-space:pre-wrap}.meta{display:flex;justify-content:space-between;margin:14px 0}.summary-table,.details{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:7px 4px;border:1px solid #ccd1d9;overflow-wrap:anywhere;text-align:left}thead{display:table-header-group}.summary-table>thead{background:#1a2232;color:white}.period-summary{background:#edf2f8;font-weight:bold;break-inside:avoid}.amount{text-align:right;font-variant-numeric:tabular-nums}.particulars{break-inside:auto}.particulars>td{break-inside:auto;padding:8px 10px 18px;border-bottom:3px solid #d9ad00}.details{font-size:9px}.details th{background:#f1f3f5;color:#1a2232}.details caption{text-align:left;padding:5px;font-weight:bold}.details th:nth-child(3){width:38%}tr{break-inside:avoid}.footer{margin-top:16px}.note{font-size:9px;margin:8px 0}@media print{th,.period-summary{print-color-adjust:exact}}</style></head><body><div class="header"><h1>${escape(input.header||input.businessName)}</h1>Statement of Accounts</div><div class="meta"><span>Period: ${escape(input.periodLabel)} · ${escape(start)} to ${escape(end)}<br>Department: ${escape(module==='all'?'All departments':module)} · Grouping: ${grouping}</span><span>Prepared by: ${escape(input.userName)}<br>Currency: UGX</span></div>${options.cashFlow.length&&module==='all'?'<p class="note">Cash from yesterday is the balance carried into each period; money in safe is its closing balance. Cash-flow balances cover the whole business.</p>':''}<table class="summary-table"><thead><tr><th scope="col">${grouping==='daily'?'Day':grouping==='monthly'?'Month':'Year'}</th>${headers}</tr></thead>${blocks||'<tbody><tr><td>No periods in the selected timeframe.</td></tr></tbody>'}</table><div class="footer">${escape(input.footer)}</div></body></html>`;
  }
  const days = [...new Set(rows.map(r => groupKey(r.date)))];
  const daily = days.map(day => {
    const entries = rows.filter(r => groupKey(r.date) === day);
    const firstDay = day.length === 4 ? day+'-01-01' : day.length === 7 ? day+'-01' : day;
    const lastDay = day.length === 4 ? day+'-12-31' : day.length === 7 ? new Date(Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7)),0)).toISOString().slice(0,10) : day;
    const today = businessDay(filter.now || new Date());
    const from = filter.period === 'custom' ? filter.start! : filter.period === 'today' ? today : filter.period === 'month' ? today.slice(0,7)+'-01' : filter.period === 'year' ? today.slice(0,4)+'-01-01' : firstDay;
    const to = filter.period === 'custom' ? (filter.dateMode === 'range' ? filter.end! : filter.start!) : today;
    const groupScope: AccountingFilter = { ...filter, period:'custom',dateMode:'range',start:from>firstDay?from:firstDay,end:to<lastDay?to:lastDay };

    return `<tbody class="day"><tr class="day-heading"><th colspan="5">${day}</th></tr>${entries.map(r => `<tr><td>${/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? (grouping === 'daily' ? '' : businessDay(r.date) + ' ') + 'Not recorded' : (grouping === 'daily' ? '' : businessDay(r.date) + ' ') + new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' }).format(new Date(r.date))}</td><td>${escape(r.type)}</td><td>${escape(r.detail)}</td><td>${escape(r.ref)}</td><td class="amount">${money(r.amount)}</td></tr>`).join('')}<tr class="day-summary"><td colspan="5"><h3>${grouping === 'daily' ? 'Daily' : grouping === 'monthly' ? 'Monthly' : 'Yearly'} summary · ${day} · ${entries.length} transaction entries</h3>${cards(groupScope)}</td></tr><tr class="separator"><td colspan="5"></td></tr></tbody>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement of Accounts - ${escape(input.businessName)}</title><style>
  @page { size: A4 landscape; margin: 12mm; } body{font:12px Arial,sans-serif;color:#1a2232;margin:24px}h1{font-size:22px;margin:8px 0}.header{text-align:center;white-space:pre-wrap}.meta{display:flex;justify-content:space-between;padding:14px 0}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.card{border:1px solid #ddd;border-radius:6px;padding:10px;break-inside:avoid}.card strong{display:block;font-size:10px;text-transform:uppercase;color:#666}.card span{display:block;font-size:14px;font-weight:bold;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:10px}thead{display:table-header-group}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}tr{break-inside:avoid}.amount{text-align:right;white-space:nowrap}.day-heading{background:#1a2232;color:white}.day-summary{background:#f5f7fa}.day-summary h3{margin:4px 0}.separator td{height:16px;border-top:3px solid #e5b900;border-bottom:0}.warning{font-size:10px;color:#805600;margin:8px 0}.footer{white-space:pre-wrap;text-align:center;margin-top:24px}@media print{body{margin:0}.card,.day-heading,.day-summary{print-color-adjust:exact}}
  </style></head><body><div class="header"><h1>${escape(input.header || input.businessName)}</h1>Statement of Accounts</div><div class="meta"><div>Period: <strong>${escape(input.periodLabel)}</strong><br>Department: <strong>${escape(module === 'all' ? 'All departments' : module)}</strong></div><div>Prepared by: ${escape(input.userName)}<br>Generated: ${escape(new Date().toLocaleString('en-GB', { timeZone: 'Africa/Kampala' }))} (Uganda)</div></div>${cards(filter)}<table><thead><tr><th>Time (Uganda)</th><th>Transaction</th><th>Details</th><th>Reference</th><th class="amount">Amount</th></tr></thead>${daily || '<tbody><tr><td colspan="5">No transactions for these filters.</td></tr></tbody>'}</table><div class="footer">${escape(input.footer)}</div></body></html>`;
}



