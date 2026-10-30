import {addStatementPrintControls} from '../statementPrinting';
import {paginateStatement} from '../statementPagination';
import DashboardCharts from './DashboardCharts';
import {useToast} from '../App';
import ActionButton from './ActionButton';
import { generateStatement } from '../statementGeneration';
import type { StatementOptions } from '../statementExport';
import Modal from './Modal';
import InfoTooltip from './InfoTooltip';

import React, { useState, useMemo } from 'react';
import { Sale, Expense, InventoryItem, StockItem, User, MaterialCategory, Customer, BankingRecord, SystemSettings, StockTransaction } from '../types';
import { allocatedSale, businessDay, inPeriod, inventoryValuation, moduleShare, profitSummary, saleDepartment } from '../reportAccounting';
import { department } from '../stockMath';
import type { DepartmentFilter } from '../reportAccounting';
import { CalendarIcon, PrintIcon, BanknotesIcon as BankIcon } from './icons';

interface ReportsViewProps {
    sales: Sale[];
    stockTransactions: StockTransaction[];
    expenses: Expense[];
    inventory: InventoryItem[];
    stockItems: StockItem[];
    materialCategories: MaterialCategory[];
    currentUser: User;
    customers?: Customer[];
    bankingRecords?: BankingRecord[];
    onAddBankingRecord?: (amount: number) => void;
    settings: SystemSettings;
}

type ReportPeriod = 'all' | 'year' | 'month' | 'today' | 'yesterday' | 'custom';
type ModuleFilter = DepartmentFilter;

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};



const ReportsView: React.FC<ReportsViewProps> = ({ sales: allSales, expenses, stockTransactions = [], inventory, stockItems, materialCategories, currentUser, bankingRecords = [], onAddBankingRecord, settings, customers = [] }) => {
    const sales = useMemo(()=>allSales.filter(s=>!s.internalComplementary),[allSales]);
    const isBankerOnly = currentUser.role === 'user' && currentUser.isBanker;
    const [period, setPeriod] = useState<ReportPeriod>('today');
    const [showBankingModal, setShowBankingModal] = useState(false);
    const [showStatementModal, setShowStatementModal] = useState(false);
    const [generatingStatement,setGeneratingStatement]=useState(false);
    const [statementError,setStatementError]=useState('');
    const {addToast}=useToast();
    const [statementPeriod, setStatementPeriod] = useState<ReportPeriod>('today');
    const [statementStart, setStatementStart] = useState(businessDay(new Date()));
    const [statementEnd, setStatementEnd] = useState(businessDay(new Date()));
    const [statementOptions, setStatementOptions] = useState<StatementOptions>({ grouping:'daily', cashFlow:['Cash from yesterday','Money banked','Money in safe'], cards:['Total invoiced','Cash collected','Outstanding debts','Cost of goods (COGS)','Gross profit','Operating expenses','Net profit','Inventory value','Net cash flow'], particulars:['Invoices','Payments','Expenses','COGS','Stock movements','Bank deposits'] });
    const [bankingAmount, setBankingAmount] = useState('');
    const [activeModule, setActiveModule] = useState<ModuleFilter>('all');
    const [dateMode, setDateMode] = useState<'specific' | 'range'>('specific');
    const [customDateStart, setCustomDateStart] = useState<string>(businessDay(new Date()));
    const [customDateEnd, setCustomDateEnd] = useState<string>(businessDay(new Date()));

    const accountingFilter = { period, dateMode, start: customDateStart, end: customDateEnd };
    const filteredData = useMemo(() => ({
        sales: sales.filter(s => !s.voidedAt && inPeriod(s.date, accountingFilter) && (activeModule === 'all' || s.items.some(i => saleDepartment(i) === activeModule))).map(s => allocatedSale(s, activeModule)),
        expenses: expenses.filter(e => inPeriod(e.date, accountingFilter) && (activeModule === 'all' || department(e.module) === activeModule)),
    }), [sales, expenses, period, activeModule, dateMode, customDateStart, customDateEnd]);
    const financials = useMemo(() => profitSummary(sales, expenses, stockTransactions, accountingFilter, activeModule),
        [sales, expenses, stockTransactions, period, activeModule, dateMode, customDateStart, customDateEnd]);
    const cashReceived = financials.cashCollected;
    const filteredBanked = bankingRecords.filter(r => inPeriod(r.date, accountingFilter)).reduce((sum,r)=>sum+r.amount,0);

    const bankingSummary = useMemo(() => {
        if (!currentUser.isBanker && currentUser.role !== 'admin') return null;
        const totalSalesCash = cashReceived;
        const totalExpensesCash = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
        return { totalSalesCash, totalExpensesCash, netCashToBank: totalSalesCash - totalExpensesCash };
    }, [cashReceived, filteredData.expenses, currentUser]);

    const safeBalance = useMemo(() => {
        const calculateTotalsAt = (toDate: Date) => {
            let cash = 0;
            sales.forEach(sale => {
                const salePayments = sale.payments || [];
                if (salePayments.length > 0) {
                    salePayments.forEach(p => {
                        if (new Date(p.date) <= toDate) cash += p.amount;
                    });
                } else if (new Date(sale.date) <= toDate) {
                    cash += (sale.amountPaid || 0);
                }
            });

            const totalExpenses = expenses.filter(e => new Date(e.date) <= toDate).reduce((sum, e) => sum + e.amount, 0);
            const totalBanked = bankingRecords.filter(r => new Date(r.date) <= toDate).reduce((sum, r) => sum + r.amount, 0);

            return cash - totalExpenses - totalBanked;
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        const safeYesterday = calculateTotalsAt(yesterday);

        // Cash received today
        let cashToday = 0;
        sales.forEach(sale => {
            const salePayments = sale.payments || [];
            if (salePayments.length > 0) {
                salePayments.forEach(p => {
                    const pDate = new Date(p.date);
                    if (pDate >= startOfToday && pDate <= now) cashToday += p.amount;
                });
            } else {
                const sDate = new Date(sale.date);
                if (sDate >= startOfToday && sDate <= now) cashToday += (sale.amountPaid || 0);
            }
        });

        // Expenses today
        const expensesToday = expenses.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= startOfToday && eDate <= now;
        }).reduce((sum, e) => sum + e.amount, 0);

        // Banked today
        const bankedToday = bankingRecords.filter(r => {
            const rDate = new Date(r.date);
            return rDate >= startOfToday && rDate <= now;
        }).reduce((sum, r) => sum + r.amount, 0);

        const currentSafe = safeYesterday + cashToday - expensesToday - bankedToday;

        return { safeYesterday, cashToday, expensesToday, bankedToday, currentSafe };
    }, [sales, expenses, bankingRecords]);

    const handleBankingSubmit = async () => {
        const amount = parseFloat(bankingAmount);
        if (isNaN(amount) || amount <= 0) return;
        if (onAddBankingRecord) await onAddBankingRecord(amount);
        setBankingAmount('');
        setShowBankingModal(false);
    };

    const totalInvoiced = useMemo(() => filteredData.sales.reduce((sum, s) => sum + s.total, 0), [filteredData.sales]);
    const totalCashCollected = bankingSummary?.totalSalesCash || 0;
    const totalExpenses = bankingSummary?.totalExpensesCash || 0;
    const netCashFlow = totalCashCollected - totalExpenses;

    const valuation = useMemo(() => inventoryValuation(stockItems, inventory, stockTransactions, accountingFilter, activeModule),
        [stockItems, inventory, stockTransactions, period, activeModule, dateMode, customDateStart, customDateEnd]);
    const inventoryReportItems = valuation.rows.map(row => ({ name: row.name, stock: `${row.units} ${row.unit}`, price: row.cost, total: row.value }));
    const totalInventoryValue = valuation.value;
    const outstandingDebts = filteredData.sales.reduce((sum, sale) => sum + Math.max(0, sale.total - (sale.amountPaid || 0)), 0);
    const financialCards: { label: string; value: number; tone: string; unavailable?: boolean }[] = [
        { label: 'Total invoiced', value: totalInvoiced, tone: 'text-gray-900' },
        { label: 'Cash collected', value: financials.cashCollected, tone: 'text-emerald-600' },
        { label: 'Outstanding debts', value: outstandingDebts, tone: 'text-rose-700' },
        ...(currentUser.role === 'admin' ? [
            { label: 'Cost of goods (COGS)', value: financials.cogs, tone: 'text-amber-700' },
            { label: 'Gross profit', value: financials.grossProfit, tone: 'text-emerald-700' },
        ] : []),
        { label: 'Operating expenses', value: financials.operatingExpenses, tone: 'text-rose-600' },
        ...(currentUser.role === 'admin' ? [
            { label: 'Net profit', value: financials.netProfit, tone: 'text-blue-700' },
            { label: 'Inventory value', value: totalInventoryValue, tone: 'text-indigo-700', unavailable: valuation.missingItems > 0 && valuation.rows.length === 0 },
        ] : [{ label: 'Net cash flow', value: netCashFlow, tone: 'text-blue-600' }]),
    ];

    const getPeriodLabel = () => {
        if (period === 'today') return 'Today';
        if (period === 'yesterday') return 'Yesterday';
        if (period === 'month') return 'This Month';
        if (period === 'year') return 'This Year';
        if (period === 'custom') {
            if (dateMode === 'specific') return new Date(customDateStart).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            return `${new Date(customDateStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${new Date(customDateEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'All Time';
    };

    const getBankingTitle = () => {
        if (period === 'today') return 'Daily Cash Flow Summary';
        if (period === 'yesterday') return 'Yesterday\'s Cash Flow Summary';
        if (period === 'month') return 'Monthly Cash Flow Summary';
        if (period === 'year') return 'Annual Cash Flow Summary';
        if (period === 'custom') {
            if (dateMode === 'specific') return `Cash Flow for ${new Date(customDateStart).toLocaleDateString()}`;
            return `Cash Flow: ${new Date(customDateStart).toLocaleDateString()} to ${new Date(customDateEnd).toLocaleDateString()}`;
        }
        return 'Total Cash Flow Summary';
    };

    const periodsToDisplay: ReportPeriod[] = isBankerOnly ? ['today', 'yesterday'] : ['today', 'month', 'year', 'all', 'custom'];

    const handleGenerateStatement = async () => {
        if(generatingStatement)return;
        if (statementPeriod === 'custom' && (!statementStart || !statementEnd || statementStart > statementEnd)) return;
        setStatementError('');
        const win=window.open('', '_blank', 'width=1100,height=850');
        if(!win){setStatementError('The statement window was blocked. Allow pop-ups for this system and try again.');return;}
        win.document.write('<!doctype html><html><head><title>Generating statement</title></head><body style="font:16px Arial;padding:40px"><p role="status">Generating your statement. Larger timeframes may take longer. Please keep this window open.</p></body></html>');win.document.close();
        setGeneratingStatement(true);
        try{
        const html = await generateStatement({ sales, expenses, stockTransactions, inventory, stockItems, customers, bankingRecords,
            filter: { period:statementPeriod,dateMode:'range',start:statementStart,end:statementEnd }, module: activeModule, admin: currentUser.role === 'admin', options:statementOptions,
            businessName: settings.businessName, header: settings.statementHeader, footer: settings.statementFooter,
            userName: currentUser.username, periodLabel: statementPeriod === 'custom' ? `${statementStart} to ${statementEnd}` : ({today:'Today',month:'This month',year:'This year',all:'All time',yesterday:'Yesterday'}[statementPeriod] || statementPeriod) });

        if(win.closed)throw new Error('The statement window was closed. Please generate it again.');
        win.document.open();win.document.write(html);win.document.close();
        await win.document.fonts.ready;
        await paginateStatement(win.document);
        await new Promise(resolve=>setTimeout(resolve,250));
        addStatementPrintControls(win.document);
        win.focus();setShowStatementModal(false);addToast('Statement ready. Use Print or Download printable PDF in the statement window.','success');
        }catch(error){
            if(!win.closed)win.close();
            setStatementError(error instanceof Error?error.message:'Unable to generate the statement. Please try again.');
        }finally{setGeneratingStatement(false);}

    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <Modal isOpen={showStatementModal} onClose={()=>{if(!generatingStatement)setShowStatementModal(false);}} title="Statement options" size="lg">
                <fieldset disabled={generatingStatement} className="space-y-6 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="text-sm font-bold">Arrange transactions
                            <select className="block w-full border rounded-xl p-3 mt-2" value={statementOptions.grouping} onChange={e=>setStatementOptions({...statementOptions,grouping:e.target.value as StatementOptions['grouping']})}>
                                <option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                            </select>
                        </label>
                        <label className="text-sm font-bold">Timeframe
                            <select className="block w-full border rounded-xl p-3 mt-2" value={statementPeriod} onChange={e=>setStatementPeriod(e.target.value as ReportPeriod)}>
                                <option value="today">Today</option><option value="month">This month</option><option value="year">This year</option><option value="all">All years / All time</option><option value="custom">Custom range</option>
                            </select>
                        </label>
                    </div>
                    {statementPeriod==='custom' && <div className="grid grid-cols-2 gap-4">
                        <label className="text-sm font-bold">From<input className="block w-full border rounded-xl p-3 mt-2" type="date" value={statementStart} onChange={e=>setStatementStart(e.target.value)}/></label>
                        <label className="text-sm font-bold">To<input className="block w-full border rounded-xl p-3 mt-2" type="date" value={statementEnd} min={statementStart} onChange={e=>setStatementEnd(e.target.value)}/></label>
                    </div>}
                    {([
                        {key:'cashFlow' as const,title:'Cash-flow fields',choices:['Cash from yesterday','Money banked','Money in safe']},
                        {key:'cards' as const,title:'Summary columns',choices:financialCards.map(c=>c.label)},
                        {key:'particulars' as const,title:'Transaction particulars',choices:['Invoices','Payments','Expenses',...(currentUser.role==='admin'?['COGS','Stock movements']:[]),'Bank deposits']},
                    ]).map(section=><fieldset key={section.key} className="border rounded-2xl p-4" disabled={section.key==='cashFlow'&&activeModule!=='all'}>
                        <legend className="px-2 text-sm font-black">{section.title}</legend>
                        {section.key==='cashFlow'&&activeModule!=='all'&&<p className="text-sm text-gray-500 mb-3">Select All departments to include business-wide cash-flow balances.</p>}
                        <div className="flex gap-4 mb-3 text-xs font-bold"><ActionButton type="button" onClick={()=>setStatementOptions({...statementOptions,[section.key]:section.choices})}>Select all</ActionButton><ActionButton type="button" onClick={()=>setStatementOptions({...statementOptions,[section.key]:[]})}>Clear</ActionButton></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{section.choices.map(choice=><label key={choice} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={statementOptions[section.key].includes(choice)} onChange={e=>setStatementOptions({...statementOptions,[section.key]:e.target.checked?[...statementOptions[section.key],choice]:statementOptions[section.key].filter(v=>v!==choice)})}/>{choice}</label>)}</div>
                    </fieldset>)}
                    <p className="text-xs text-gray-500">Selected fields become table columns. Each day, month or year has one summary row, followed by its selected transaction particulars. Choosing no particulars creates a summary-only table. Statements print on A4 landscape. Cash-flow balances use the whole business.</p>
                    {statementPeriod==='custom'&&(!statementStart||!statementEnd||statementStart>statementEnd)&&<p role="alert" className="text-red-600 text-sm">Choose a valid start and end date.</p>}
                    <ActionButton loadingLabel="Generating statement..." aria-busy={generatingStatement} className="w-full bg-gray-900 text-yellow-400 font-black rounded-xl p-3 disabled:opacity-40" disabled={generatingStatement||statementPeriod==='custom'&&(!statementStart||!statementEnd||statementStart>statementEnd)} onClick={handleGenerateStatement}>{generatingStatement?<span role="status" className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true"/>Generating statement...</span>:'Generate statement'}</ActionButton>
                    {statementError&&<p role="alert" className="text-red-600 text-sm">{statementError}</p>}
                </fieldset>
            </Modal>

            {/* 1. Merged header bar */}
            <div className="bg-white px-4 py-3 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">
                    Dashboard: <span className="text-yellow-500">{getPeriodLabel()}</span>
                </span>
                <InfoTooltip label="Report calculations and information"><p>The financial cards follow the selected dates and department. Cash collected follows payment dates. Outstanding debts are the current unpaid balances of invoices issued in the selected dates and department; overpayments on other invoices do not reduce these debts. The cash safe banner shows today's cash across the entire business.</p>{currentUser.role === 'admin' && <><p>Gross profit = cash collected minus COGS. Net profit = gross profit minus operating expenses minus net stock gains / losses. COGS includes started materials and resale costs. Purchases and opening balances are excluded. Stock losses reduce profit; gains add.</p><p>Inventory closing date: {valuation.closingDay}.</p>{financials.missingCogs > 0 && <p>{financials.missingCogs} historical sale lines lack COGS; profit is provisional.</p>}{valuation.missingItems > 0 && <p>{valuation.missingItems} stock records lack usable cost/opening history and are excluded from valuation.</p>}</>}</InfoTooltip><div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

                {/* Period pills */}
                <div className="flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto scrollbar-hide gap-0.5">
                    {periodsToDisplay.map(p => (
                        <ActionButton key={p} onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center whitespace-nowrap flex-shrink-0 ${period === p ? 'bg-white text-blue-600 shadow' : 'text-gray-400 hover:text-gray-700'}`}>
                            {p === 'custom' && <CalendarIcon className="w-3 h-3 mr-1" />}
                            {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'all' ? 'All Time' : p === 'year' ? 'This Year' : p === 'month' ? 'This Month' : 'Custom'}
                        </ActionButton>
                    ))}
                </div>

                {/* Custom date inputs */}
                {period === 'custom' && !isBankerOnly && (
                    <div className="flex items-center gap-1.5 fade-in">
                        <select value={dateMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateMode(e.target.value as 'specific' | 'range')}
                            className="h-[30px] rounded-lg border-none bg-[#374151] px-2 text-[9px] font-black text-white outline-none focus:ring-2 focus:ring-yellow-400">
                            <option value="specific">Specific</option>
                            <option value="range">Range</option>
                        </select>
                        <input aria-label="Report start date" type="date" value={customDateStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCustomDateStart(e.target.value); if (dateMode === 'specific') setCustomDateEnd(e.target.value); }}
                            className="h-[30px] rounded-lg border-none bg-[#374151] px-2 text-[9px] font-bold text-blue-300 outline-none focus:ring-2 focus:ring-yellow-400" />
                        {dateMode === 'range' && (
                            <>
                                <span className="text-gray-300 text-[9px] font-black">—</span>
                                <input aria-label="Report end date" type="date" value={customDateEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomDateEnd(e.target.value)}
                                    className="h-[30px] rounded-lg border-none bg-[#374151] px-2 text-[9px] font-bold text-blue-300 outline-none focus:ring-2 focus:ring-yellow-400" />
                            </>
                        )}
                    </div>
                )}

                <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

                {/* Module pills */}
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {(['all', 'large-format', 'dtf', 'embroidery', 'bizhub', 'supplies', 'products', 'Unassigned'] as ModuleFilter[]).map(mod => (
                        <ActionButton key={mod} onClick={() => setActiveModule(mod)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeModule === mod ? 'bg-[#1a2232] text-yellow-400 shadow' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700'}`}>
                            {mod === 'all' ? 'All' : mod === 'large-format' ? 'LF' : mod.toUpperCase()}
                        </ActionButton>
                    ))}
                </div>

                <div className="ml-auto">
                    <ActionButton onClick={() => {setStatementPeriod(period);setStatementStart(customDateStart);setStatementEnd(customDateEnd);setShowStatementModal(true);}} className="flex items-center bg-[#1A2232] text-yellow-400 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md active:scale-95 whitespace-nowrap border border-yellow-400/20">
                        <PrintIcon className="w-3.5 h-3.5 mr-1" /> Statement
                    </ActionButton>
                </div>
            </div>


            {/* 2. High-Contrast Cash Flow Banner */}
            {bankingSummary && (
                <div className="bg-[#1a2232] rounded-[2rem] shadow-2xl px-6 py-5 text-white relative overflow-hidden group">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl group-hover:bg-yellow-400/20 transition-all duration-700"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-700"></div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-black uppercase tracking-tight flex items-center">
                                <div className="w-1 h-4 bg-yellow-400 mr-2.5 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)]"></div>
                                Cash Flow
                            </h2>
                            <span className="text-[9px] bg-yellow-400 text-gray-900 px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg">
                                Banking · {getPeriodLabel()}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-all">
                                <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Cash From Yesterday</p>
                                <p className="text-lg font-black text-blue-400 tracking-tight">{formatUGX(safeBalance.safeYesterday)}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-all">
                                <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Money Banked · {getPeriodLabel()}</p>
                                <p className="text-lg font-black text-emerald-400 tracking-tight">{formatUGX(filteredBanked)}</p>
                            </div>
                            <div className="bg-white px-4 py-3 rounded-2xl shadow-xl border-l-8 border-yellow-400 transform hover:scale-[1.02] transition-transform relative group/safe overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/safe:opacity-100 transition-opacity">
                                    <ActionButton
                                        onClick={() => setShowBankingModal(true)}
                                        className="bg-gray-900 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center"
                                    >
                                        <BankIcon className="w-3 h-3 mr-1" /> Bank
                                    </ActionButton>
                                </div>
                                <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Money In Safe</p>
                                <p className="text-xl font-black text-[#1a2232] tracking-tighter">{formatUGX(safeBalance.currentSafe)}</p>
                                {safeBalance.bankedToday > 0 && (
                                    <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase italic">
                                        Banked: {formatUGX(safeBalance.bankedToday)}
                                    </p>
                                )}
                            </div>
                        </div>
                        
                    </div>
                </div>
            )}

            {/* One financial row, driven by the shared date and department filters. */}
            <section aria-label="Filtered financial summary" className="space-y-2">
                <div className={`grid grid-cols-2 sm:grid-cols-4 ${currentUser.role === 'admin' ? 'lg:grid-cols-8' : ''} gap-2`}>
                    {financialCards.map(card => <div key={card.label} className={`min-w-0 px-2.5 py-3 rounded-2xl shadow-sm border ${card.label === 'Net profit' ? 'bg-blue-50 border-blue-100' : card.label === 'Gross profit' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
                        <h3 className="text-[9px] min-h-[36px] leading-tight font-black text-gray-500 uppercase tracking-wide">{card.label}</h3>
                        <p className={`text-[clamp(11px,1.1vw,18px)] font-black tracking-tight tabular-nums whitespace-nowrap ${card.tone}`}>{card.unavailable ? 'No history' : formatUGX(card.value).replace(' UGX', '')}</p>
                        <span className="text-[8px] font-bold text-gray-400">{card.unavailable ? 'Not available' : 'UGX'}</span>
                    </div>)}
                </div>
            </section>

            <DashboardCharts sales={sales} expenses={expenses} movements={stockTransactions} filter={accountingFilter} module={activeModule} admin={currentUser.role==='admin'}/>

            {/* 5. Inventory Valuation Section - Refined UI */}
            <div className="bg-[#f0f4f8] p-10 rounded-[3rem] shadow-2xl border border-white/50 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-6 relative z-10">
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Inventory Valuation (Closing Balance)</h3>
                    <div className="bg-white px-8 py-5 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center min-w-[200px] transform hover:scale-105 transition-transform">
                        <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Asset Value</span>
                        <p className="text-3xl font-black text-[#1a2232] tracking-tighter leading-none">{valuation.missingItems > 0 && valuation.rows.length === 0 ? 'History unavailable' : formatUGX(totalInventoryValue)}</p>
                    </div>
                </div>

                <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                        <thead className="text-[10px] uppercase font-black text-gray-400 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Item Specification</th>
                                <th className="px-6 py-4">Closing Stock</th>
                                <th className="px-6 py-4 text-right">Average Unit Cost</th>
                                <th className="px-6 py-4 text-right">Aggregate Value</th>
                            </tr>
                        </thead>
                        <tbody className="">
                            {inventoryReportItems.map((item, idx) => (
                                <tr key={idx} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                    <td className="px-6 py-5 font-black text-gray-800 uppercase tracking-tight rounded-l-2xl border-l-4 border-transparent group-hover:border-yellow-400">{item.name}</td>
                                    <td className="px-6 py-5 font-bold text-gray-500">{item.stock}</td>
                                    <td className="px-6 py-5 text-right font-medium text-gray-400">{formatUGX(item.price)}</td>
                                    <td className="px-6 py-5 font-black text-right text-gray-900 rounded-r-2xl">{formatUGX(item.total)}</td>
                                </tr>
                            ))}
                            {inventoryReportItems.length === 0 && (
                                <tr className="bg-white/50 rounded-2xl">
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-black uppercase tracking-widest text-[10px]">No materials found for current filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Background design elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            </div>
            {/* Banking Modal */}
            {showBankingModal && (
                <div className="fixed inset-0 bg-[#1a2232]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 transform scale-100 transition-all border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center mb-8">
                                <div className="p-3 bg-yellow-400 rounded-2xl shadow-lg mr-4">
                                    <BankIcon className="w-6 h-6 text-[#1a2232]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Bank Money</h3>
                                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Update Safe Balance</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Amount to Bank (UGX)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={bankingAmount}
                                            onChange={(e) => setBankingAmount(e.target.value)}
                                            placeholder="Enter amount..."
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-yellow-400 focus:bg-white rounded-[1.2rem] px-6 py-4 text-lg font-black text-gray-900 transition-all outline-none"
                                            autoFocus
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xs uppercase tracking-widest">UGX</div>
                                    </div>
                                    <p className="mt-4 text-[11px] font-bold text-gray-500 bg-gray-50 p-4 rounded-2xl italic leading-relaxed">
                                        * Banking <span className="text-gray-900 underline">{formatUGX(parseFloat(bankingAmount) || 0)}</span> will reduce the money in safe from <span className="text-yellow-600 font-black">{formatUGX(safeBalance.currentSafe)}</span> to <span className="text-emerald-600 font-black">{formatUGX(safeBalance.currentSafe - (parseFloat(bankingAmount) || 0))}</span>.
                                    </p>
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <ActionButton
                                        onClick={() => { setShowBankingModal(false); setBankingAmount(''); }}
                                        className="flex-1 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                                    >
                                        Cancel
                                    </ActionButton>
                                    <ActionButton
                                        onClick={handleBankingSubmit}
                                        disabled={!bankingAmount || parseFloat(bankingAmount) <= 0}
                                        className="flex-[2] bg-gray-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
                                    >
                                        Confirm Deposit
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsView;

