
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Sale, Expense, InventoryItem, StockItem, User } from '../types';
import { ArrowUpCircleIcon } from './icons';

interface ReportsViewProps {
  sales: Sale[];
  expenses: Expense[];
  inventory: InventoryItem[];
  stockItems: StockItem[];
  currentUser: User;
}

type ReportPeriod = 'all' | 'year' | 'month' | 'today';

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const ROLL_LENGTH_METERS = 50;

const ReportsView: React.FC<ReportsViewProps> = ({ sales, expenses, inventory, stockItems, currentUser }) => {
  const [period, setPeriod] = useState<ReportPeriod>('all');

  const filteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayString = now.toDateString();

    const filterByPeriod = <T extends { date: string }>(data: T[]): T[] => {
      if (period === 'all') return data;
      return data.filter(item => {
        const itemDate = new Date(item.date);
        if (period === 'year') {
          return itemDate.getFullYear() === currentYear;
        }
        if (period === 'month') {
          return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
        }
        if (period === 'today') {
           return itemDate.toDateString() === todayString;
        }
        return true;
      });
    };
    return {
      sales: filterByPeriod(sales),
      expenses: filterByPeriod(expenses),
    };
  }, [sales, expenses, period]);

  // Banking Logic (Dynamic based on selected period)
  const bankingSummary = useMemo(() => {
      if (!currentUser.isBanker && currentUser.role !== 'admin') return null;

      // Use filteredData to respect the selected period (Today, Month, Year, All Time)
      const totalSalesCash = filteredData.sales.reduce((sum, s) => sum + s.total, 0);
      const totalExpensesCash = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
      const netCashToBank = totalSalesCash - totalExpensesCash;

      return {
          totalSalesCash,
          totalExpensesCash,
          netCashToBank
      };
  }, [filteredData, currentUser]);


  const totalRevenue = filteredData.sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = filteredData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  const totalMaterialsValue = stockItems.reduce((sum, item) => sum + ((item.totalStockMeters || 0) / ROLL_LENGTH_METERS) * item.lastPurchasePricePerRoll_UGX, 0);

  const topSellingItems = useMemo(() => {
    const itemSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    filteredData.sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!itemSales[item.name]) { // Group by name for better aggregation
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

  const getPeriodTitle = () => {
    if(period === 'today') return 'Today';
    if(period === 'month') return 'This Month';
    if(period === 'year') return 'This Year';
    return 'All Time';
  }

  const getBankingTitle = () => {
      if (period === 'today') return 'Daily Banking / Closing Summary';
      if (period === 'month') return 'Monthly Cash Flow Summary';
      if (period === 'year') return 'Annual Cash Flow Summary';
      return 'Total Cash Flow Summary';
  };

  const getBankingDateBadge = () => {
      const now = new Date();
      if (period === 'today') return now.toLocaleDateString();
      if (period === 'month') return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (period === 'year') return now.getFullYear().toString();
      return 'All Time';
  };

  return (
    <div className="space-y-6">
      
      {/* Banking / Closing Summary - Only for Banker/Admin */}
      {bankingSummary && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg shadow-lg p-6 text-white mb-8">
              <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
                  <h2 className="text-xl font-bold flex items-center">
                       {getBankingTitle()}
                  </h2>
                  <span className="text-sm bg-yellow-500 text-gray-900 px-3 py-1 rounded-full font-bold">
                      {getBankingDateBadge()}
                  </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
                      <p className="text-gray-300 text-sm uppercase tracking-wider">Total Sales ({getPeriodTitle()})</p>
                      <p className="text-2xl font-bold text-green-400 mt-1">{formatUGX(bankingSummary.totalSalesCash)}</p>
                  </div>
                  <div className="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
                      <p className="text-gray-300 text-sm uppercase tracking-wider">Total Expenses ({getPeriodTitle()})</p>
                      <p className="text-2xl font-bold text-red-400 mt-1">{formatUGX(bankingSummary.totalExpensesCash)}</p>
                  </div>
                  <div className="bg-white text-gray-900 p-4 rounded-lg shadow-md border-l-4 border-yellow-500">
                      <p className="text-gray-600 text-sm uppercase tracking-wider font-bold">Net Cash to Bank</p>
                      <p className="text-3xl font-bold text-blue-800 mt-1">{formatUGX(bankingSummary.netCashToBank)}</p>
                  </div>
              </div>
              <p className="text-gray-400 text-xs mt-4 text-center italic">
                  * This summary represents total cash flow for the entire business for the selected period ({getPeriodTitle()}).
              </p>
          </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-700">Business Reports: <span className="text-yellow-600">{getPeriodTitle()}</span></h2>
        <div className="flex space-x-2 p-1 bg-gray-200 rounded-lg">
            {(['today', 'month', 'year', 'all'] as ReportPeriod[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
                    {p === 'today' ? 'Today' : p === 'all' ? 'All Time' : p === 'year' ? 'This Year' : 'This Month'}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm"><h3 className="text-gray-500">Total Revenue</h3><p className="text-2xl font-bold text-green-600">{formatUGX(totalRevenue)}</p></div>
        <div className="bg-white p-6 rounded-lg shadow-sm"><h3 className="text-gray-500">Total Expenses</h3><p className="text-2xl font-bold text-red-600">{formatUGX(totalExpenses)}</p></div>
        <div className="bg-white p-6 rounded-lg shadow-sm"><h3 className="text-gray-500">Net Profit</h3><p className="text-2xl font-bold text-blue-600">{formatUGX(netProfit)}</p></div>
        <div className="bg-white p-6 rounded-lg shadow-sm"><h3 className="text-gray-500">Profit Margin</h3><p className="text-2xl font-bold text-purple-600">{profitMargin.toFixed(1)}%</p></div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-semibold text-gray-700 mb-4">Expenses by Category</h3>
           <ResponsiveContainer width="100%" height={300}>
               <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                        {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatUGX(value)}/>
                    <Legend />
                </PieChart>
           </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-semibold text-gray-700 mb-4">Top 5 Selling Items (by Revenue)</h3>
            <div className="space-y-4">
            {topSellingItems.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-800 font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-semibold text-green-600">{formatUGX(item.revenue)}</span>
                </div>
            ))}
            {topSellingItems.length === 0 && <p className="text-gray-500">No sales data for this period.</p>}
            </div>
        </div>
      </div>

       <div className="bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-semibold text-gray-700 mb-4">Materials Inventory Valuation (All Time)</h3>
            <p className="text-3xl font-bold text-gray-800 mb-4">{formatUGX(totalMaterialsValue)}</p>
            <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                             <th className="px-4 py-2">Item Name</th>
                             <th className="px-4 py-2">Stock (m)</th>
                             <th className="px-4 py-2 text-right">Price/Roll</th>
                             <th className="px-4 py-2 text-right">Total Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stockItems.map(item => {
                            const rolls = (item.totalStockMeters || 0) / ROLL_LENGTH_METERS;
                            const value = rolls * item.lastPurchasePricePerRoll_UGX;
                            return (
                                <tr key={item.skuId} className="border-b">
                                    <td className="px-4 py-2 font-medium">{item.itemName}</td>
                                    <td className="px-4 py-2">{(item.totalStockMeters || 0).toFixed(1)}m</td>
                                    <td className="px-4 py-2 text-right">{formatUGX(item.lastPurchasePricePerRoll_UGX)}</td>
                                    <td className="px-4 py-2 font-semibold text-right">{formatUGX(value)}</td>
                                </tr>
                            )
                         })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ReportsView;
