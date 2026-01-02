
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Sale, Expense, InventoryItem, StockItem, User, MaterialCategory, Payment } from '../types';
import { CalendarIcon, BanknotesIcon, ArrowUpCircleIcon, ArrowDownCircleIcon, DocumentTextIcon, PrintIcon } from './icons';

interface ReportsViewProps {
  sales: Sale[];
  expenses: Expense[];
  inventory: InventoryItem[];
  stockItems: StockItem[];
  materialCategories: MaterialCategory[];
  currentUser: User;
}

type ReportPeriod = 'all' | 'year' | 'month' | 'today' | 'yesterday' | 'custom';
type ModuleFilter = 'all' | 'largeformat' | 'dtf' | 'embroidery' | 'bizhub' | 'supplies' | 'products';

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const ROLL_LENGTH_METERS = 50;

const ReportsView: React.FC<ReportsViewProps> = ({ sales, expenses, inventory, stockItems, materialCategories, currentUser }) => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [activeModule, setActiveModule] = useState<ModuleFilter>('all');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

    const isDateInPeriod = (dateStr: string) => {
        const itemDate = new Date(dateStr);
        if (period === 'year') return itemDate.getFullYear() === currentYear;
        if (period === 'month') return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
        if (period === 'today') return itemDate.toDateString() === todayString;
        if (period === 'yesterday') return itemDate.toDateString() === yesterdayString;
        if (period === 'custom') return itemDate.toDateString() === new Date(customDate).toDateString();
        return true;
    };

    // Filter Sales for Invoiced Revenue
    let filteredSales = sales.filter(s => isDateInPeriod(s.date));

    // Filter Payments for Actual Cash Received (Collections)
    // This allows payments made TODAY for an invoice from LAST YEAR to show up today.
    let allPaymentsInPeriod: { amount: number, date: string, saleId: string }[] = [];
    sales.forEach(sale => {
        if (sale.payments) {
            sale.payments.forEach(p => {
                if (isDateInPeriod(p.date)) {
                    allPaymentsInPeriod.push({ amount: p.amount, date: p.date, saleId: sale.id });
                }
            });
        }
    });

    let filteredExpenses = expenses.filter(e => isDateInPeriod(e.date));

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
        
        // Note: allPaymentsInPeriod are harder to filter by module since they link to the whole sale.
        // We'll filter them by checking if the sale they belong to matches the module.
        allPaymentsInPeriod = allPaymentsInPeriod.filter(p => {
            const sale = sales.find(s => s.id === p.saleId);
            return sale && sale.items.some(item => checkModuleMatch(item.name));
        });
    }

    return { 
        sales: filteredSales, 
        expenses: filteredExpenses,
        collections: allPaymentsInPeriod
    };
  }, [sales, expenses, period, activeModule, customDate]);

  const totalInvoiced = filteredData.sales.reduce((sum, s) => sum + s.total, 0);
  const totalCollections = filteredData.collections.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashFlow = totalCollections - totalExpenses;
  const cashProfitMargin = totalCollections > 0 ? (netCashFlow / totalCollections) * 100 : 0;
  
  const inventoryReportItems = useMemo(() => {
    const results: { name: string, stock: string, total: number }[] = [];
    stockItems.forEach(item => {
        if (activeModule === 'all' || item.module === activeModule) {
            const rolls = (item.totalStockMeters || 0) / ROLL_LENGTH_METERS;
            results.push({ name: item.itemName, stock: `${(item.totalStockMeters || 0).toFixed(1)}m`, total: rolls * item.lastPurchasePricePerRoll_UGX });
        }
    });
    inventory.forEach(item => {
        if (activeModule === 'all' || item.module === activeModule) {
            results.push({ name: item.name, stock: `${item.quantity} units`, total: item.quantity * (item.price || 0) });
        }
    });
    return results;
  }, [stockItems, inventory, activeModule]);

  const totalInventoryValue = inventoryReportItems.reduce((sum, item) => sum + item.total, 0);

  const trendData = useMemo(() => {
    if (period === 'all' || period === 'year') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((m, idx) => {
            const monthSales = sales.filter(s => new Date(s.date).getMonth() === idx && new Date(s.date).getFullYear() === new Date().getFullYear());
            const monthPayments = sales.flatMap(s => s.payments || []).filter(p => new Date(p.date).getMonth() === idx && new Date(p.date).getFullYear() === new Date().getFullYear());
            return {
                name: m,
                invoiced: monthSales.reduce((sum, s) => sum + s.total, 0),
                collected: monthPayments.reduce((sum, p) => sum + p.amount, 0)
            };
        });
    }
    
    // For month/today/custom, show daily trend for last 14 days
    const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
    }).reverse();

    return days.map(d => {
        const dStr = d.toDateString();
        const daySales = sales.filter(s => new Date(s.date).toDateString() === dStr);
        const dayPayments = sales.flatMap(s => s.payments || []).filter(p => new Date(p.date).toDateString() === dStr);
        return {
            name: d.toLocaleDateString([], { day: 'numeric', month: 'short' }),
            invoiced: daySales.reduce((sum, s) => sum + s.total, 0),
            collected: dayPayments.reduce((sum, p) => sum + p.amount, 0)
        };
    });
  }, [sales, period]);

  const expenseByCategory = useMemo(() => {
    const totals: { [key: string]: number } = {};
    filteredData.expenses.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredData.expenses]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const getPeriodLabel = () => {
    if(period === 'today') return 'Today';
    if(period === 'yesterday') return 'Yesterday';
    if(period === 'month') return 'This Month';
    if(period === 'year') return 'This Year';
    if(period === 'custom') return new Date(customDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return 'All Time';
  };

  return (
    <div className="fade-in space-y-12 max-w-7xl mx-auto">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div>
            <h2 className="text-4xl font-black text-[#1A2232] tracking-tighter uppercase leading-none">Financial Audit</h2>
            <p className="text-gray-400 text-xs font-black uppercase tracking-[0.4em] mt-3 ml-1">Invoiced Revenue vs. Cash Collections</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white p-1.5 rounded-3xl shadow-sm border border-gray-100">
                {(['today', 'yesterday', 'month', 'year', 'all', 'custom'] as ReportPeriod[]).map(p => (
                    <button 
                        key={p} 
                        onClick={() => setPeriod(p)} 
                        className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${period === p ? 'bg-[#1A2232] text-yellow-400 shadow-xl scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        {p}
                    </button>
                ))}
            </div>
            {period === 'custom' && (
                <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex items-center pr-4">
                    <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase text-blue-600 focus:ring-0" />
                </div>
            )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {(['all', 'largeformat', 'dtf', 'embroidery', 'bizhub', 'supplies', 'products'] as ModuleFilter[]).map(mod => (
            <button
                key={mod}
                onClick={() => setActiveModule(mod)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${activeModule === mod ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'}`}
            >
                {mod === 'all' ? 'Consolidated View' : mod.replace(/([A-Z])/g, ' $1').trim()}
            </button>
        ))}
      </div>

      <div className="bg-[#1A2232] rounded-[3.5rem] p-12 text-white relative overflow-hidden group">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-yellow-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)]"></div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{getPeriodLabel()} - Performance Overview</h2>
                </div>
                <div className="flex gap-2">
                    <button className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><DocumentTextIcon className="w-5 h-5 text-gray-400" /></button>
                    <button className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><PrintIcon className="w-5 h-5 text-gray-400" /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Invoiced Value</p>
                    <p className="text-3xl font-black text-blue-400 tracking-tighter">{formatUGX(totalInvoiced)}</p>
                    <p className="mt-2 text-[9px] text-gray-400 font-bold uppercase">Work billed in this period</p>
                </div>
                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Operating Expenses</p>
                    <p className="text-3xl font-black text-rose-400 tracking-tighter">{formatUGX(totalExpenses)}</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-rose-400 font-black">
                        <ArrowDownCircleIcon className="w-4 h-4" /> Outflow Tracked
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl border-l-8 border-yellow-400 transform hover:scale-[1.05] transition-transform duration-500">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Actual Cash Collected</p>
                    <p className="text-4xl font-black text-[#1A2232] tracking-tighter leading-none">{formatUGX(totalCollections)}</p>
                    <p className="mt-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">* Includes debt recovery from past sales</p>
                </div>
                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Net Cash Flow</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatUGX(netCashFlow)}</p>
                    <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, (netCashFlow / (totalCollections || 1)) * 100))}%` }}></div>
                    </div>
                </div>
            </div>
          </div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-50 flex flex-col">
           <div className="flex justify-between items-center mb-10">
               <div>
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Cash Flow Trajectory</h3>
                   <p className="text-lg font-black text-gray-900 uppercase">Invoiced vs. Collected</p>
               </div>
               <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                       <span className="text-[9px] font-black text-gray-400 uppercase">Invoiced</span>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                       <span className="text-[9px] font-black text-gray-400 uppercase">Collected</span>
                   </div>
               </div>
           </div>
           <div className="flex-1 min-h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} tick={{dy: 10}} />
                        <YAxis tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} stroke="#cbd5e1" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '20px' }}
                            formatter={(value: number) => formatUGX(value)}
                        />
                        <Area type="monotone" dataKey="invoiced" stroke="#2563eb" strokeWidth={3} fill="url(#colorInv)" />
                        <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={3} fill="url(#colorCol)" />
                    </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-50 flex flex-col">
           <div className="flex justify-between items-center mb-10">
               <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Expenditure Profile</h3>
               <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-4 py-1.5 rounded-full uppercase">Cost Centers</span>
           </div>
           <div className="flex-1 min-h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                        <Pie 
                            data={expenseByCategory} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" cy="50%" 
                            innerRadius={80} outerRadius={120} 
                            paddingAngle={8} 
                        >
                            {expenseByCategory.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />)}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '20px' }}
                            formatter={(value: number) => formatUGX(value)}
                        />
                        <Legend iconType="circle" verticalAlign="bottom" align="center" />
                    </PieChart>
               </ResponsiveContainer>
           </div>
        </div>
      </div>

       <div className="bg-[#f8fafc] p-12 rounded-[4rem] border border-gray-100 shadow-inner">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-8">
               <div>
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mb-2">Inventory Equity Analysis</h3>
                   <p className="text-2xl font-black text-[#1A2232] uppercase">Consolidated Asset Value</p>
               </div>
               <div className="bg-[#1A2232] p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center min-w-[280px] transform hover:rotate-1 transition-transform">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2">Total Holding Value</span>
                    <p className="text-3xl font-black text-yellow-400 tracking-tighter leading-none">{formatUGX(totalInventoryValue)}</p>
               </div>
           </div>
           
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inventoryReportItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-white hover:border-yellow-400 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Item Description</p>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{item.stock}</span>
                        </div>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight mb-4 group-hover:text-blue-600 transition-colors">{item.name}</h4>
                        <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Book Value</span>
                            <span className="font-black text-gray-900">{formatUGX(item.total)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default ReportsView;
