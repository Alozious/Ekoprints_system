
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Sale, Expense, InventoryItem, StockItem, User, MaterialCategory } from '../types';
import { CalendarIcon } from './icons';

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
  const isBankerOnly = currentUser.role === 'user' && currentUser.isBanker;
  const [period, setPeriod] = useState<ReportPeriod>('today');
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
              if (period === 'custom') return itemDate.toDateString() === new Date(customDate).toDateString();
              return true;
          });
          filteredExpenses = filteredExpenses.filter(e => {
              const itemDate = new Date(e.date);
              if (period === 'year') return itemDate.getFullYear() === currentYear;
              if (period === 'month') return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
              if (period === 'today') return itemDate.toDateString() === todayString;
              if (period === 'yesterday') return itemDate.toDateString() === yesterdayString;
              if (period === 'custom') return itemDate.toDateString() === new Date(customDate).toDateString();
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
  }, [sales, expenses, period, activeModule, customDate]);

  const bankingSummary = useMemo(() => {
      if (!currentUser.isBanker && currentUser.role !== 'admin') return null;
      const totalSalesCash = filteredData.sales.reduce((sum, s) => sum + s.total, 0);
      const totalExpensesCash = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
      return { totalSalesCash, totalExpensesCash, netCashToBank: totalSalesCash - totalExpensesCash };
  }, [filteredData, currentUser]);

  const totalRevenue = bankingSummary?.totalSalesCash || 0;
  const totalExpenses = bankingSummary?.totalExpensesCash || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
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
        if(!categoryTotals[expense.category]) categoryTotals[expense.category] = 0;
        categoryTotals[expense.category] += expense.amount;
    });
    return Object.entries(categoryTotals).map(([name, value]) => ({name, value}));
  }, [filteredData.expenses]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const getPeriodLabel = () => {
    if(period === 'today') return 'Today';
    if(period === 'yesterday') return 'Yesterday';
    if(period === 'month') return 'This Month';
    if(period === 'year') return 'This Year';
    if(period === 'custom') return new Date(customDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return 'All Time';
  };

  const getBankingTitle = () => {
      if (period === 'today') return 'Daily Cash Flow Summary';
      if (period === 'yesterday') return 'Yesterday\'s Cash Flow Summary';
      if (period === 'month') return 'Monthly Cash Flow Summary';
      if (period === 'year') return 'Annual Cash Flow Summary';
      if (period === 'custom') return `Cash Flow for ${new Date(customDate).toLocaleDateString()}`;
      return 'Total Cash Flow Summary';
  };

  const periodsToDisplay: ReportPeriod[] = isBankerOnly ? ['today', 'yesterday'] : ['today', 'month', 'year', 'all', 'custom'];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* 1. Header and Filters Section */}
      <div className="space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                Business Reports: <span className="text-yellow-600">{getPeriodLabel()}</span>
            </h2>
            
            <div className="flex flex-wrap items-center gap-3">
                {period === 'custom' && !isBankerOnly && (
                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 p-1 pr-3 fade-in group">
                        <div className="p-2 text-gray-400 group-hover:text-blue-500 transition-colors">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <input 
                            type="date" 
                            value={customDate} 
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest text-blue-600 outline-none"
                        />
                    </div>
                )}
                
                <div className="flex bg-gray-200/50 p-1 rounded-[1.2rem] shadow-inner border border-gray-200">
                    {periodsToDisplay.map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p)} 
                            className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center ${period === p ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {p === 'custom' && <CalendarIcon className="w-3 h-3 mr-1.5" />}
                            {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'all' ? 'All Time' : p === 'year' ? 'This Year' : p === 'month' ? 'This Month' : 'Specific Date'}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Module Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'largeformat', 'dtf', 'embroidery', 'bizhub', 'supplies', 'products'] as ModuleFilter[]).map(mod => (
                <button
                    key={mod}
                    onClick={() => setActiveModule(mod)}
                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${activeModule === mod ? 'bg-[#1a2232] text-yellow-400 border-[#1a2232] shadow-lg scale-105' : 'bg-white text-gray-400 border-gray-50 hover:border-yellow-400 hover:text-gray-700'}`}
                >
                    {mod === 'all' ? 'Unified View' : mod.replace(/([A-Z])/g, ' $1').trim()}
                </button>
            ))}
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
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Sales ({getPeriodLabel()})</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">{formatUGX(bankingSummary.totalSalesCash)}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm hover:bg-white/10 transition-all">
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Expenses ({getPeriodLabel()})</p>
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
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Total Revenue</h3>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatUGX(totalRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-rose-500 transition-colors">Total Expenses</h3>
            <p className="text-2xl font-black text-rose-600 tracking-tight">{formatUGX(totalExpenses)}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Net Profit</h3>
            <p className="text-2xl font-black text-blue-600 tracking-tight">{formatUGX(netProfit)}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow group">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-purple-500 transition-colors">Profit Margin</h3>
            <p className="text-2xl font-black text-purple-600 tracking-tight">{profitMargin.toFixed(1)}%</p>
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
