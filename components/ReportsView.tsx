
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Sale, Expense, InventoryItem, StockItem, User, MaterialCategory, Customer } from '../types';
import { CalendarIcon, PrintIcon } from './icons';

interface ReportsViewProps {
    sales: Sale[];
    expenses: Expense[];
    inventory: InventoryItem[];
    stockItems: StockItem[];
    materialCategories: MaterialCategory[];
    currentUser: User;
    customers?: Customer[];
}

type ReportPeriod = 'all' | 'year' | 'month' | 'today' | 'yesterday' | 'custom';
type ModuleFilter = 'all' | 'largeformat' | 'dtf' | 'embroidery' | 'bizhub' | 'supplies' | 'products';

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const ROLL_LENGTH_METERS = 50;

const ReportsView: React.FC<ReportsViewProps> = ({ sales, expenses, inventory, stockItems, materialCategories, currentUser, customers = [] }) => {
    const isBankerOnly = currentUser.role === 'user' && currentUser.isBanker;
    const [period, setPeriod] = useState<ReportPeriod>('today');
    const [activeModule, setActiveModule] = useState<ModuleFilter>('all');
    const [dateMode, setDateMode] = useState<'specific' | 'range'>('specific');
    const [customDateStart, setCustomDateStart] = useState<string>(new Date().toISOString().split('T')[0]);
    const [customDateEnd, setCustomDateEnd] = useState<string>(new Date().toISOString().split('T')[0]);

    const moduleKeywords: Record<ModuleFilter, string[]> = {
        all: [],
        largeformat: ['print', 'banner', 'vinyl', 'flex', 'stickers', 'rollup'],
        dtf: ['dtf', 'direct to film'],
        embroidery: ['embroidery', 'uniform', 'cap', 'polo', 'shirt', 'thread'],
        bizhub: ['bizhub', 'photocopy', 'card', 'flyer', 'poster', 'paper', 'toner'],
        supplies: ['ink', 'powder', 'solution', 'clean', 'toner'],
        products: ['jumper', 'hoodie', 't-shirt', 'bottle', 'mug'],
    };

    const filteredData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const todayString = now.toDateString();

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        const checkModuleMatch = (itemName: string) => {
            if (activeModule === 'all') return true;
            const keywords = moduleKeywords[activeModule];
            const lowerName = itemName.toLowerCase();
            return keywords.some(k => lowerName.includes(k));
        };

        const filterByPeriodAndModule = (salesList: Sale[], expensesList: Expense[]) => {
            let filteredSales = salesList;
            let filteredExpenses = expensesList;

            if (period !== 'all') {
                filteredSales = filteredSales.filter(s => {
                    const itemDate = new Date(s.date);
                    if (period === 'year') return itemDate.getFullYear() === currentYear;
                    if (period === 'month') return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
                    if (period === 'today') return itemDate.toDateString() === todayString;
                    if (period === 'yesterday') return itemDate.toDateString() === yesterdayString;
                    if (period === 'custom') {
                        if (dateMode === 'specific') return itemDate.toDateString() === new Date(customDateStart).toDateString();
                        const start = new Date(customDateStart);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(customDateEnd);
                        end.setHours(23, 59, 59, 999);
                        return itemDate >= start && itemDate <= end;
                    }
                    return true;
                });
                filteredExpenses = filteredExpenses.filter(e => {
                    const itemDate = new Date(e.date);
                    if (period === 'year') return itemDate.getFullYear() === currentYear;
                    if (period === 'month') return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
                    if (period === 'today') return itemDate.toDateString() === todayString;
                    if (period === 'yesterday') return itemDate.toDateString() === yesterdayString;
                    if (period === 'custom') {
                        if (dateMode === 'specific') return itemDate.toDateString() === new Date(customDateStart).toDateString();
                        const start = new Date(customDateStart);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(customDateEnd);
                        end.setHours(23, 59, 59, 999);
                        return itemDate >= start && itemDate <= end;
                    }
                    return true;
                });
            }

            if (activeModule !== 'all') {
                filteredSales = filteredSales.map(sale => {
                    const matchedItems = sale.items.filter(item => checkModuleMatch(item.name));
                    if (matchedItems.length === 0) return null as any;
                    return {
                        ...sale,
                        items: matchedItems,
                        total: matchedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                    };
                }).filter(Boolean);

                filteredExpenses = filteredExpenses.filter(exp => {
                    const catLower = exp.category.toLowerCase();
                    const descLower = exp.description.toLowerCase();
                    const keywords = moduleKeywords[activeModule];
                    return keywords.some(k => catLower.includes(k) || descLower.includes(k));
                });
            }

            return { sales: filteredSales, expenses: filteredExpenses };
        };

        return filterByPeriodAndModule(sales, expenses);
    }, [sales, expenses, period, activeModule, dateMode, customDateStart, customDateEnd]);

    const cashReceived = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const todayString = now.toDateString();

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        let total = 0;

        sales.forEach(sale => {
            if (activeModule !== 'all') {
                const keywords = moduleKeywords[activeModule];
                const hasModuleItem = sale.items.some(item => {
                    const lowerName = item.name.toLowerCase();
                    return keywords.some(k => lowerName.includes(k));
                });
                if (!hasModuleItem) return;
            }

            if (sale.payments && sale.payments.length > 0) {
                sale.payments.forEach(payment => {
                    const pDate = new Date(payment.date);
                    let match = false;
                    if (period === 'all') match = true;
                    else if (period === 'year') match = pDate.getFullYear() === currentYear;
                    else if (period === 'month') match = pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
                    else if (period === 'today') match = pDate.toDateString() === todayString;
                    else if (period === 'yesterday') match = pDate.toDateString() === yesterdayString;
                    else if (period === 'custom') {
                        if (dateMode === 'specific') match = pDate.toDateString() === new Date(customDateStart).toDateString();
                        else {
                            const start = new Date(customDateStart); start.setHours(0, 0, 0, 0);
                            const end = new Date(customDateEnd); end.setHours(23, 59, 59, 999);
                            match = pDate >= start && pDate <= end;
                        }
                    }

                    if (match) total += payment.amount;
                });
            } else {
                // Fallback for legacy records if they lack payments array but have amountPaid
                const sDate = new Date(sale.date);
                let match = false;
                if (period === 'all') match = true;
                else if (period === 'year') match = sDate.getFullYear() === currentYear;
                else if (period === 'month') match = sDate.getFullYear() === currentYear && sDate.getMonth() === currentMonth;
                else if (period === 'today') match = sDate.toDateString() === todayString;
                else if (period === 'yesterday') match = sDate.toDateString() === yesterdayString;
                else if (period === 'custom') {
                    if (dateMode === 'specific') match = sDate.toDateString() === new Date(customDateStart).toDateString();
                    else {
                        const start = new Date(customDateStart); start.setHours(0, 0, 0, 0);
                        const end = new Date(customDateEnd); end.setHours(23, 59, 59, 999);
                        match = sDate >= start && sDate <= end;
                    }
                }

                if (match) total += (sale.amountPaid || 0);
            }
        });
        return total;
    }, [sales, period, activeModule, dateMode, customDateStart, customDateEnd]);

    const bankingSummary = useMemo(() => {
        if (!currentUser.isBanker && currentUser.role !== 'admin') return null;
        const totalSalesCash = cashReceived;
        const totalExpensesCash = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
        return { totalSalesCash, totalExpensesCash, netCashToBank: totalSalesCash - totalExpensesCash };
    }, [cashReceived, filteredData.expenses, currentUser]);

    const totalInvoiced = useMemo(() => filteredData.sales.reduce((sum, s) => sum + s.total, 0), [filteredData.sales]);
    const totalCashCollected = bankingSummary?.totalSalesCash || 0;
    const totalExpenses = bankingSummary?.totalExpensesCash || 0;
    const netCashFlow = totalCashCollected - totalExpenses;

    const inventoryReportItems = useMemo(() => {
        const results: { name: string, stock: string, price: number, total: number }[] = [];

        // Stock Items (Meter-based)
        stockItems.forEach(item => {
            const cat = materialCategories.find(c => c.id === item.categoryId);
            const catName = cat ? cat.name.toLowerCase() : '';
            const keywords = activeModule === 'all' ? [] : moduleKeywords[activeModule];

            if (activeModule === 'all' || keywords.some(k => catName.includes(k) || item.itemName.toLowerCase().includes(k))) {
                const rolls = (item.totalStockMeters || 0) / ROLL_LENGTH_METERS;
                const value = rolls * item.lastPurchasePricePerRoll_UGX;
                results.push({
                    name: item.itemName,
                    stock: `${(item.totalStockMeters || 0).toFixed(1)}m`,
                    price: item.lastPurchasePricePerRoll_UGX,
                    total: value
                });
            }
        });

        // Inventory Items (Unit-based)
        inventory.forEach(item => {
            const keywords = activeModule === 'all' ? [] : moduleKeywords[activeModule];
            if (activeModule === 'all' || keywords.some(k => item.category.toLowerCase().includes(k) || item.name.toLowerCase().includes(k))) {
                const value = item.quantity * (item.purchasePrice || 0);
                results.push({
                    name: item.name,
                    stock: `${item.quantity} units`,
                    price: item.purchasePrice || 0,
                    total: value
                });
            }
        });

        return results;
    }, [stockItems, inventory, activeModule, materialCategories]);

    const totalInventoryValue = useMemo(() => {
        return inventoryReportItems.reduce((sum, item) => sum + item.total, 0);
    }, [inventoryReportItems]);

    const topSellingItems = useMemo(() => {
        const itemSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        filteredData.sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!itemSales[item.name]) {
                    itemSales[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                }
                itemSales[item.name].quantity += item.quantity;
                itemSales[item.name].revenue += item.quantity * item.price;
            });
        });
        return Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [filteredData.sales]);

    const expenseByCategory = useMemo(() => {
        const categoryTotals: { [key: string]: number } = {};
        filteredData.expenses.forEach(expense => {
            if (!categoryTotals[expense.category]) categoryTotals[expense.category] = 0;
            categoryTotals[expense.category] += expense.amount;
        });
        return Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
    }, [filteredData.expenses]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

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

    const handleGenerateStatement = () => {
        const transactions: { date: Date, type: 'income' | 'expense', mainDetail: string, subDetail: string, amount: number, ref: string }[] = [];

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const todayString = now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        // 1. Process Sales (Payments)
        sales.forEach(sale => {
            if (activeModule !== 'all') {
                const keywords = moduleKeywords[activeModule];
                const hasModuleItem = sale.items.some(item => {
                    const lowerName = item.name.toLowerCase();
                    return keywords.some(k => lowerName.includes(k));
                });
                if (!hasModuleItem) return;
            }

            const customer = customers.find(c => c.id === sale.customerId);
            const customerName = customer ? customer.name : 'Guest / Walk-in';
            const productsList = sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ');

            const processPayment = (dateStr: string, amount: number, desc: string) => {
                const pDate = new Date(dateStr);
                let match = false;
                if (period === 'all') match = true;
                else if (period === 'year') match = pDate.getFullYear() === currentYear;
                else if (period === 'month') match = pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
                else if (period === 'today') match = pDate.toDateString() === todayString;
                else if (period === 'yesterday') match = pDate.toDateString() === yesterdayString;
                else if (period === 'custom') {
                    if (dateMode === 'specific') match = pDate.toDateString() === new Date(customDateStart).toDateString();
                    else {
                        const start = new Date(customDateStart); start.setHours(0, 0, 0, 0);
                        const end = new Date(customDateEnd); end.setHours(23, 59, 59, 999);
                        match = pDate >= start && pDate <= end;
                    }
                }

                if (match) {
                    transactions.push({
                        date: pDate,
                        type: 'income',
                        mainDetail: customerName,
                        subDetail: productsList,
                        amount: amount,
                        ref: sale.id.substring(0, 8).toUpperCase()
                    });
                }
            };

            if (sale.payments && sale.payments.length > 0) {
                sale.payments.forEach(p => processPayment(p.date, p.amount, `Payment: Invoice #${sale.id.substring(0, 8).toUpperCase()}`));
            } else {
                processPayment(sale.date, sale.amountPaid || 0, `Legacy Sale #${sale.id.substring(0, 8).toUpperCase()}`);
            }
        });

        // 2. Process Expenses
        filteredData.expenses.forEach(exp => {
            transactions.push({
                date: new Date(exp.date),
                type: 'expense',
                mainDetail: exp.category,
                subDetail: exp.description,
                amount: exp.amount,
                ref: 'EXP'
            });
        });

        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const net = totalIncome - totalExpense;

        const html = `
            <html>
            <head>
                <title>Statement of Accounts - Eko Prints</title>
                <style>
                    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                    .logo { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; background: #f9fafb; padding: 15px; border-radius: 8px; }
                    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
                    .card { flex: 1; padding: 15px; border: 1px solid #eee; border-radius: 8px; text-align: center; }
                    .card h4 { margin: 0 0 5px 0; font-size: 10px; text-transform: uppercase; color: #888; }
                    .card p { margin: 0; font-size: 18px; font-weight: 900; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { text-align: left; border-bottom: 2px solid #333; padding: 10px 5px; text-transform: uppercase; }
                    td { border-bottom: 1px solid #eee; padding: 10px 5px; }
                    .text-right { text-align: right; }
                    .income { color: #10b981; } .expense { color: #ef4444; }
                </style>
            </head>
            <body>
                <div class="header"><div class="logo">Eko Prints</div><div>Statement of Accounts</div></div>
                <div class="meta">
                    <div><strong>Period:</strong> ${getPeriodLabel()}<br><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
                    <div style="text-align:right"><strong>User:</strong> ${currentUser.username}<br><strong>Scope:</strong> ${activeModule.toUpperCase()}</div>
                </div>
                <div class="summary">
                    <div class="card"><h4>Total Income</h4><p class="income">${formatUGX(totalIncome)}</p></div>
                    <div class="card"><h4>Total Expenses</h4><p class="expense">${formatUGX(totalExpense)}</p></div>
                    <div class="card"><h4>Net Cash Flow</h4><p style="color:${net >= 0 ? '#10b981' : '#ef4444'}">${formatUGX(net)}</p></div>
                </div>
                <table>
                    <thead><tr><th>Date</th><th>Transaction Details</th><th>Ref</th><th class="text-right">Income</th><th class="text-right">Expense</th></tr></thead>
                    <tbody>
                        ${transactions.map(t => `<tr><td>${t.date.toLocaleDateString()}</td><td><div style="font-weight:bold;margin-bottom:2px">${t.mainDetail}</div><div style="font-size:10px;color:#666;line-height:1.3">${t.subDetail}</div></td><td>${t.ref}</td><td class="text-right income">${t.type === 'income' ? formatUGX(t.amount) : '-'}</td><td class="text-right expense">${t.type === 'expense' ? formatUGX(t.amount) : '-'}</td></tr>`).join('')}
                        ${transactions.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:20px">No transactions found</td></tr>' : ''}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        const win = window.open('', '_blank', 'width=900,height=900');
        if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">

            {/* 1. Header and Filters Section - Redesigned */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                            Business Intelligence
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {getPeriodLabel()} • {activeModule === 'all' ? 'Unified Scope' : activeModule.toUpperCase()}
                        </p>
                    </div>

                    <button
                        onClick={handleGenerateStatement}
                        className="group flex items-center bg-[#1a2232] text-yellow-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 transition-all shadow-xl active:scale-95 border border-yellow-400/10"
                    >
                        <PrintIcon className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                        Export Statement
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 pt-4 border-t border-gray-50">
                    {/* Period Selection */}
                    <div className="space-y-2 flex-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Timeframe</label>
                        <div className="flex flex-wrap gap-2">
                            {periodsToDisplay.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${period === p
                                            ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm'
                                            : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    {p === 'custom' ? 'Custom Range' : p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'all' ? 'All Time' : p === 'year' ? 'This Year' : 'This Month'}
                                </button>
                            ))}
                        </div>

                        {period === 'custom' && !isBankerOnly && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 bg-gray-50 p-2 rounded-xl border border-gray-100 w-fit animate-in fade-in slide-in-from-top-2 duration-200">
                                <select
                                    value={dateMode}
                                    onChange={(e) => setDateMode(e.target.value as 'specific' | 'range')}
                                    className="bg-white border-none rounded-lg py-1.5 pl-3 pr-8 text-[10px] font-black uppercase tracking-widest text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                                >
                                    <option value="specific">Single Date</option>
                                    <option value="range">Date Range</option>
                                </select>
                                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                                <input
                                    type="date"
                                    value={customDateStart}
                                    onChange={(e) => {
                                        setCustomDateStart(e.target.value);
                                        if (dateMode === 'specific') setCustomDateEnd(e.target.value);
                                    }}
                                    className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest text-gray-600 focus:ring-0 cursor-pointer"
                                />
                                {dateMode === 'range' && (
                                    <>
                                        <span className="text-gray-400 text-[10px] font-black">to</span>
                                        <input
                                            type="date"
                                            value={customDateEnd}
                                            onChange={(e) => setCustomDateEnd(e.target.value)}
                                            className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest text-gray-600 focus:ring-0 cursor-pointer"
                                        />
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Module Selection */}
                    <div className="space-y-2 flex-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Module</label>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'largeformat', 'dtf', 'embroidery', 'bizhub', 'supplies', 'products'] as ModuleFilter[]).map(mod => (
                                <button
                                    key={mod}
                                    onClick={() => setActiveModule(mod)}
                                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${activeModule === mod
                                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm'
                                            : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    {mod === 'all' ? 'All' : mod.replace(/([A-Z])/g, ' $1').trim()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. High-Contrast Cash Flow Banner */}
            {bankingSummary && (
                <div className="bg-[#1a2232] rounded-[2.5rem] shadow-2xl p-8 text-white relative overflow-hidden group">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl group-hover:bg-yellow-400/20 transition-all duration-700"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-700"></div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center">
                                <div className="w-1.5 h-6 bg-yellow-400 mr-3 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)]"></div>
                                {getBankingTitle()}
                            </h2>
                            <span className="text-[10px] bg-yellow-400 text-gray-900 px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg">
                                {getPeriodLabel()}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm hover:bg-white/10 transition-all">
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Cash From Sales ({getPeriodLabel()})</p>
                                <p className="text-2xl font-black text-emerald-400 tracking-tight">{formatUGX(bankingSummary.totalSalesCash)}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm hover:bg-white/10 transition-all">
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Cash Expenses ({getPeriodLabel()})</p>
                                <p className="text-2xl font-black text-rose-400 tracking-tight">{formatUGX(bankingSummary.totalExpensesCash)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-xl border-l-8 border-yellow-400 transform hover:scale-[1.02] transition-transform">
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Net Cash to Bank</p>
                                <p className="text-3xl font-black text-[#1a2232] tracking-tighter">{formatUGX(bankingSummary.netCashToBank)}</p>
                            </div>
                        </div>
                        <p className="text-gray-500 text-[9px] mt-6 text-center italic font-bold uppercase tracking-widest opacity-60">
                            * This summary represents total cash flow for the entire business for the selected period ({getPeriodLabel()}).
                        </p>
                    </div>
                </div>
            )}

            {/* 3. Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-gray-900 transition-colors">Total Invoiced (Sales)</h3>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">{formatUGX(totalInvoiced)}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Cash Collected</h3>
                    <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatUGX(totalCashCollected)}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-rose-500 transition-colors">Total Expenses</h3>
                    <p className="text-2xl font-black text-rose-600 tracking-tight">{formatUGX(totalExpenses)}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Net Cash Flow</h3>
                    <p className="text-2xl font-black text-blue-600 tracking-tight">{formatUGX(netCashFlow)}</p>
                </div>
            </div>

            {/* 4. Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Expenses by Category</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={expenseByCategory}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                fill="#8884d8"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                className="outline-none"
                            >
                                {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontWeight: 900 }}
                                formatter={(value: number) => formatUGX(value)}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Top 5 Selling Items (by Revenue)</h3>
                    <div className="space-y-6">
                        {topSellingItems.map((item, idx) => (
                            <div key={item.name} className="flex items-center justify-between group">
                                <div className="flex items-center">
                                    <span className="w-6 h-6 rounded-lg bg-gray-900 text-white flex items-center justify-center text-[10px] font-black mr-4 shadow-md">{idx + 1}</span>
                                    <div>
                                        <p className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{item.name}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">Qty: {item.quantity}</p>
                                    </div>
                                </div>
                                <span className="font-black text-emerald-600 text-sm">{formatUGX(item.revenue)}</span>
                            </div>
                        ))}
                        {topSellingItems.length === 0 && (
                            <div className="py-20 text-center">
                                <p className="text-xs text-gray-300 font-black uppercase tracking-[0.3em]">No data for current filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. Inventory Valuation Section - Refined UI */}
            <div className="bg-[#f0f4f8] p-10 rounded-[3rem] shadow-2xl border border-white/50 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-6 relative z-10">
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Materials Inventory Valuation (Current Snapshot)</h3>
                    <div className="bg-white px-8 py-5 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center min-w-[200px] transform hover:scale-105 transition-transform">
                        <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Asset Value</span>
                        <p className="text-3xl font-black text-[#1a2232] tracking-tighter leading-none">{formatUGX(totalInventoryValue)}</p>
                    </div>
                </div>

                <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                        <thead className="text-[10px] uppercase font-black text-gray-400 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Item Specification</th>
                                <th className="px-6 py-4">Current Stock</th>
                                <th className="px-6 py-4 text-right">Unit/Roll Price</th>
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
        </div>
    );
};

export default ReportsView;
