
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { Sale, Expense, StockItem, User, SaleItem } from '../types';
// Add missing icon imports from icons.tsx
import { AlertTriangleIcon, BeakerIcon, ChevronDownIcon, SearchIcon, SalesIcon, ExpensesIcon, BanknotesIcon, InventoryIcon } from './icons';
import Modal from './Modal';
import { useToast } from '../App';

interface DashboardViewProps {
  sales: Sale[];
  expenses: Expense[];
  stockItems: StockItem[];
  currentUser: User;
  onStockOut: (skuId: string, metersUsed: number, jobId: string, notes: string) => Promise<void>;
  onUpdateSale: (sale: Sale) => Promise<void>;
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const ROLL_LENGTH_METERS = 50;

/**
 * Custom Searchable Select for Materials Logging
 */
const SearchableMaterialSelect: React.FC<{
    items: StockItem[];
    value: string;
    onChange: (skuId: string) => void;
}> = ({ items, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        const sorted = [...items].sort((a, b) => b.width - a.width);
        if (!search) return sorted;
        const s = search.toLowerCase();
        return sorted.filter(i => 
            i.itemName.toLowerCase().includes(s) || 
            String(i.width).includes(s) || 
            String(i.width * 100).includes(s)
        );
    }, [items, search]);

    const selectedItem = items.find(i => i.skuId === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-black font-bold"
            >
                <span className="truncate">
                    {selectedItem ? `${selectedItem.width}m | ${selectedItem.itemName}` : "Select Material Roll..."}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
                    <div className="sticky top-0 p-2 bg-white border-b border-gray-100">
                        <div className="relative">
                            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-8 pr-2 py-1.5 text-xs text-black border border-gray-200 rounded focus:outline-none focus:border-purple-500"
                                placeholder="Search width..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <ul className="max-h-60 overflow-auto py-1">
                        {filtered.length > 0 ? (
                            filtered.map(i => (
                                <li
                                    key={i.skuId}
                                    onClick={() => {
                                        onChange(i.skuId);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="px-3 py-2 text-xs text-black hover:bg-purple-50 cursor-pointer flex justify-between"
                                >
                                    <span><strong>{i.width}m</strong> | {i.itemName}</span>
                                    <span className="text-gray-400 font-mono">({(i.totalStockMeters || 0).toFixed(1)}m)</span>
                                </li>
                            ))
                        ) : (
                            <li className="px-3 py-4 text-xs text-center text-gray-500 italic">No materials found</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

const DashboardView: React.FC<DashboardViewProps> = ({ sales, expenses, stockItems, currentUser, onStockOut, onUpdateSale }) => {
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [saleForUsage, setSaleForUsage] = useState<Sale | null>(null);
  const [usageEntries, setUsageEntries] = useState<{[key: string]: { skuId: string, meters: number }}>({});
  const { addToast } = useToast();

  const isLoggable = (sale: Sale) => {
      if (sale.usageLogged) return false;
      return sale.items.some(item => 
          item.name.toLowerCase().includes('print') || 
          item.name.toLowerCase().includes('roll') ||
          item.name.toLowerCase().includes('dtf') ||
          item.name.toLowerCase().includes('banner')
      );
  };

  const pendingLogs = useMemo(() => {
      return sales.filter(isLoggable);
  }, [sales]);
  
  const { relevantSales, relevantExpenses } = useMemo(() => {
      const today = new Date().toDateString();
      if (currentUser.role === 'admin') {
          return { relevantSales: sales, relevantExpenses: expenses };
      } else {
          const userSalesToday = sales.filter(s => s.userId === currentUser.id && new Date(s.date).toDateString() === today);
          const userExpensesToday = expenses.filter(e => e.userId === currentUser.id && new Date(e.date).toDateString() === today);
          return { relevantSales: userSalesToday, relevantExpenses: userExpensesToday };
      }
  }, [sales, expenses, currentUser]);

  const totalRevenue = relevantSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = relevantExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  
  const totalMaterialsValue = currentUser.role === 'admin' 
      ? stockItems.reduce((sum, item) => sum + ((item.totalStockMeters || 0) / ROLL_LENGTH_METERS) * item.lastPurchasePricePerRoll_UGX, 0) 
      : 0;

  const salesData = relevantSales
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(s => ({ name: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'}), sales: s.total }));
    
  const lowStockItems = stockItems.filter(item => (item.totalStockMeters || 0) <= item.reorderLevel);

  const StatCard = ({ title, value, colorClass, icon }: { title: string; value: string; colorClass: string, icon: React.ReactNode}) => (
    <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-center space-x-5 border border-gray-50 group hover:shadow-xl transition-all duration-300">
        <div className={`p-4 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
            <p className="text-xl font-black text-gray-900 mt-1">{value}</p>
        </div>
    </div>
  );

  const handleOpenUsageModal = (sale: Sale) => {
      setSaleForUsage(sale);
      const initialEntries: {[key: string]: { skuId: string, meters: number }} = {};
      sale.items.forEach((item, index) => {
          const lowerName = item.name.toLowerCase();
          if (lowerName.includes('print') || lowerName.includes('roll') || lowerName.includes('dtf') || lowerName.includes('banner')) {
              const match = stockItems.find(s => lowerName.includes(s.itemName.split(' ')[0].toLowerCase()));
              initialEntries[index] = { skuId: match?.skuId || '', meters: 0 };
          }
      });
      setUsageEntries(initialEntries);
      setIsUsageModalOpen(true);
  };

  const handleSaveUsage = async () => {
    if (!saleForUsage) return;
    let processedCount = 0;
    // Fix: Explicitly type entries to avoid 'unknown' property access errors
    const entries = Object.entries(usageEntries) as [string, { skuId: string, meters: number }][];
    for (const [index, entry] of entries) {
        if (entry.skuId && entry.meters > 0) {
            const item = saleForUsage.items[parseInt(index)];
            await onStockOut(entry.skuId, entry.meters, `Invoice #${saleForUsage.id.substring(0,8)}`, `Usage for ${item.name}`);
            processedCount++;
        }
    }
    if (processedCount > 0) {
        await onUpdateSale({ ...saleForUsage, usageLogged: true });
        addToast(`Inventory updated and log recorded for ${processedCount} items.`, "success");
    }
    setIsUsageModalOpen(false);
    setSaleForUsage(null);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <style>{`
        @keyframes pulse-soft {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .animate-pulse-soft {
          animation: pulse-soft 2.5s infinite;
        }
      `}</style>

      {pendingLogs.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-6 shadow-2xl animate-pulse-soft relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center z-10">
                <div className="bg-red-500 p-4 rounded-2xl mr-5 text-white shadow-lg">
                    <BeakerIcon className="w-10 h-10" />
                </div>
                <div>
                    <h3 className="text-red-900 font-black text-xl uppercase tracking-tight">Attention: Usage Logs Pending</h3>
                    <p className="text-red-600 font-bold text-sm">Action required for <span className="underline decoration-2">{pendingLogs.length}</span> invoices to maintain stock accuracy.</p>
                </div>
            </div>
            <button 
                onClick={() => handleOpenUsageModal(pendingLogs[0])}
                className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center uppercase tracking-widest text-xs z-10 shrink-0"
            >
                Log Recent Transaction
            </button>
            <BeakerIcon className="absolute right-0 bottom-0 w-32 h-32 text-red-500 opacity-5 -mr-8 -mb-8 rotate-12" />
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{currentUser.role === 'admin' ? 'Enterprise Dashboard' : 'Your Day At A Glance'}</h2>
        <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-4 py-1.5 rounded-full tracking-[0.2em] uppercase">{new Date().toDateString()}</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={currentUser.role === 'admin' ? "Gross Revenue" : "Sales Today"} value={formatUGX(totalRevenue)} colorClass="bg-emerald-50 text-emerald-600" icon={<SalesIcon className="w-6 h-6" />}/>
        <StatCard title={currentUser.role === 'admin' ? "Expenditure" : "Expenses Today"} value={formatUGX(totalExpenses)} colorClass="bg-rose-50 text-rose-600" icon={<ExpensesIcon className="w-6 h-6" />}/>
        <StatCard title={currentUser.role === 'admin' ? "Net Earnings" : "Net Sales"} value={formatUGX(netProfit)} colorClass="bg-sky-50 text-sky-600" icon={<BanknotesIcon className="w-6 h-6" />}/>
        {currentUser.role === 'admin' && (
            <StatCard title="Inventory Value" value={formatUGX(totalMaterialsValue)} colorClass="bg-indigo-50 text-indigo-600" icon={<InventoryIcon className="w-6 h-6" />}/>
        )}
      </div>
      
       {lowStockItems.length > 0 && (
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border-l-8 border-yellow-400">
                <div className="flex items-center mb-6">
                    <div className="p-3 bg-yellow-100 rounded-xl mr-4 text-yellow-700">
                        <AlertTriangleIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Replenishment Alerts</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lowStockItems.slice(0, 6).map(item => (
                        <div key={item.skuId} className="flex justify-between items-center p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <span className="font-black text-gray-800 text-xs uppercase truncate pr-4">{item.itemName}</span>
                            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded">
                                {(item.totalStockMeters || 0).toFixed(1)}m Left
                            </span>
                        </div>
                    ))}
                    {lowStockItems.length > 6 && <p className="text-[10px] text-gray-400 font-black uppercase text-center py-2">+ {lowStockItems.length - 6} more alerts</p>}
                </div>
            </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50">
           <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Revenue Trajectory</h3>
           <ResponsiveContainer width="100%" height={320}>
                <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} tick={{dy: 10}} />
                    <YAxis tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} stroke="#94a3b8" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 900, fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                </LineChart>
           </ResponsiveContainer>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50">
           <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Performance Leaderboard</h3>
            <div className="space-y-6">
            {
                relevantSales.flatMap(s => s.items)
                    .reduce((acc, item) => {
                        const existing = acc.find(i => i.name === item.name);
                        if (existing) {
                            existing.quantity += item.quantity;
                            existing.price += item.quantity * item.price;
                        } else {
                            acc.push({ itemId: item.itemId, name: item.name, quantity: item.quantity, price: item.price * item.quantity });
                        }
                        return acc;
                    }, [] as {itemId: string, name: string, quantity: number, price: number}[])
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 5)
                    .map((item, idx) => (
                    <div key={item.itemId} className="flex items-center justify-between group">
                        <div className="flex items-center">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-900 text-white rounded-lg text-[10px] font-black mr-4">{idx + 1}</span>
                            <div>
                                <p className="text-xs font-black text-gray-800 uppercase tracking-tighter truncate max-w-[140px]">{item.name}</p>
                                <p className="text-[9px] text-gray-400 font-bold">{item.quantity} Units Sold</p>
                            </div>
                        </div>
                        <span className="font-black text-gray-900 text-xs">{formatUGX(item.price)}</span>
                    </div>
                ))
            }
            {relevantSales.length === 0 && <p className="text-sm text-gray-300 text-center py-20 font-bold italic">No transactional data yet</p>}
            </div>
        </div>
      </div>

      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Machine Production Log">
          <div className="space-y-8">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-xs text-blue-900 font-bold leading-relaxed">
                      Confirm machine output for <strong>Invoice #{saleForUsage?.id.substring(0,8).toUpperCase()}</strong>. Accurate logging ensures inventory levels match actual usage.
                  </p>
              </div>
              
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                              <th className="px-6 py-4">Item</th>
                              <th className="px-6 py-4">Source Material</th>
                              <th className="px-6 py-4 text-right">Consumption (m)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {saleForUsage?.items.map((item, index) => {
                              const isPrintItem = item.name.toLowerCase().includes('print') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('dtf') || item.name.toLowerCase().includes('banner');
                              if (!isPrintItem) return null;
                              
                              return (
                                  <tr key={index}>
                                      <td className="px-6 py-4 font-black text-gray-800 text-xs uppercase">{item.name}</td>
                                      <td className="px-6 py-4">
                                          <SearchableMaterialSelect 
                                            items={stockItems}
                                            value={usageEntries[index]?.skuId || ''}
                                            onChange={(skuId) => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], skuId } }))}
                                          />
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            value={usageEntries[index]?.meters || ''} 
                                            placeholder="0.00"
                                            onChange={e => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], meters: parseFloat(e.target.value) || 0 } }))}
                                            className="block w-24 ml-auto text-right text-xs rounded-xl border-gray-300 shadow-inner focus:ring-2 focus:ring-blue-500 font-black text-blue-600 p-3"
                                          />
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>

              <button 
                onClick={handleSaveUsage} 
                className="w-full bg-[#0f172a] text-yellow-400 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:bg-gray-800 transition-all active:scale-95 border border-yellow-400/20"
              >
                Submit Usage Log & Re-calculate Stock
              </button>
          </div>
      </Modal>
    </div>
  );
};

export default DashboardView;
