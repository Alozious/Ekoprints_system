
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { Sale, Expense, StockItem, User, SaleItem } from '../types';
import { AlertTriangleIcon, BeakerIcon, ChevronDownIcon, SearchIcon } from './icons';
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
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-black"
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
  
  // Filter data based on role for stats
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
    
  const lowStockItems = stockItems.filter(item => {
    const stock = item.totalStockMeters || 0;
    return stock <= item.reorderLevel;
  });

  const StatCard = ({ title, value, colorClass, icon }: { title: string; value: string; colorClass: string, icon: React.ReactNode}) => (
    <div className="bg-white p-5 rounded-lg shadow-sm flex items-center space-x-4 border border-gray-100">
        <div className={`p-3 rounded-full ${colorClass}`}>
          {icon}
        </div>
        <div>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <p className="text-2xl font-bold text-black">{value}</p>
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
              initialEntries[index] = { 
                  skuId: match?.skuId || '', 
                  meters: 0
              };
          }
      });
      
      setUsageEntries(initialEntries);
      setIsUsageModalOpen(true);
  };

  const handleSaveUsage = async () => {
    if (!saleForUsage) return;
    
    let processedCount = 0;
    const entries = Object.entries(usageEntries) as [string, { skuId: string, meters: number }][];
    
    for (const [index, entry] of entries) {
        if (entry.skuId && entry.meters > 0) {
            const item = saleForUsage.items[parseInt(index)];
            await onStockOut(
                entry.skuId, 
                entry.meters, 
                `Invoice #${saleForUsage.id.substring(0,8)}`, 
                `Usage for ${item.name}`
            );
            processedCount++;
        }
    }

    if (processedCount > 0) {
        await onUpdateSale({
            ...saleForUsage,
            usageLogged: true
        });
        addToast(`Inventory updated and log recorded for ${processedCount} items.`, "success");
    } else {
        addToast("No valid usage entries were recorded.", "info");
    }
    
    setIsUsageModalOpen(false);
    setSaleForUsage(null);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .animate-pulse-red {
          animation: pulse-red 2s infinite;
        }
      `}</style>

      {/* Persistent Blinking Action Alert for Logs */}
      {pendingLogs.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 sm:p-6 shadow-xl animate-pulse-red relative overflow-hidden group">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                <div className="flex items-center">
                    <div className="bg-red-500 p-3 rounded-full mr-4 text-white">
                        <BeakerIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-red-800 font-extrabold text-lg sm:text-xl uppercase tracking-tight">Pending Usage Logs Found!</h3>
                        <p className="text-red-600 font-semibold">There are <span className="underline">{pendingLogs.length}</span> sales awaiting machine printing logs. Accuracy of your stock depends on this.</p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => handleOpenUsageModal(pendingLogs[0])}
                        className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    >
                        Log Most Recent Now
                    </button>
                    {pendingLogs.length > 1 && (
                        <p className="text-xs text-red-400 text-center font-bold">And {pendingLogs.length - 1} other invoices pending...</p>
                    )}
                </div>
            </div>
            <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                 <BeakerIcon className="w-32 h-32 -mr-8 -mt-8 rotate-12" />
            </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-black">{currentUser.role === 'admin' ? 'Overview' : 'Your Daily Summary'}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={currentUser.role === 'admin' ? "Total Revenue" : "Your Sales Today"} value={formatUGX(totalRevenue)} colorClass="bg-green-100 text-green-600" icon={<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}/>
        <StatCard title={currentUser.role === 'admin' ? "Total Expenses" : "Your Expenses Today"} value={formatUGX(totalExpenses)} colorClass="bg-red-100 text-red-600" icon={<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}/>
        <StatCard title={currentUser.role === 'admin' ? "Net Profit" : "Net Sales"} value={formatUGX(netProfit)} colorClass="bg-blue-100 text-blue-600" icon={<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}/>
        {currentUser.role === 'admin' && (
            <StatCard title="Materials Value" value={formatUGX(totalMaterialsValue)} colorClass="bg-purple-100 text-purple-600" icon={<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.1.25-.504-1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}/>
        )}
      </div>
      
       {lowStockItems.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-400 slide-in-up">
                <h3 className="text-lg font-semibold text-yellow-600 mb-4 flex items-center">
                    <AlertTriangleIcon className="w-6 h-6 mr-3" /> Low Stock Alerts
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {lowStockItems.map(item => (
                        <div key={item.skuId} className="flex justify-between items-center p-2 rounded-md bg-yellow-50">
                            <span className="font-medium text-black">{item.itemName}</span>
                            <span className="text-sm text-yellow-700">
                                In Stock: <strong>{(item.totalStockMeters || 0).toFixed(1)}m</strong> (Reorder at: {item.reorderLevel}m)
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-semibold text-black mb-4">Sales Overview ({currentUser.role === 'admin' ? 'All Time' : 'Today'})</h3>
           <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#000" />
                    <YAxis tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(val)} stroke="#000" />
                    <Tooltip formatter={(value: number) => formatUGX(value)} contentStyle={{ color: 'black' }} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
           </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-semibold text-black mb-4">Top Selling Products</h3>
            <div className="space-y-4">
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
                    .map(item => (
                    <div key={item.itemId} className="flex items-center justify-between">
                        <span className="text-black text-sm">{item.name}</span>
                        <span className="font-bold text-black text-sm">{formatUGX(item.price)}</span>
                    </div>
                ))
            }
            {relevantSales.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No sales data available.</p>}
            </div>
        </div>
      </div>

      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Log Machine Printing Usage">
          <div className="space-y-6">
              <p className="text-sm text-gray-600">
                  Select the material roll used and enter the actual machine printed length (meters) for <strong>Invoice #{saleForUsage?.id.substring(0,8)}</strong>.
              </p>
              
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px]">
                          <tr>
                              <th className="px-4 py-3">Invoice Item</th>
                              <th className="px-4 py-3">Inventory Material (Rolls)</th>
                              <th className="px-4 py-3 text-right">Meters Printed</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                          {saleForUsage?.items.map((item, index) => {
                              const isPrintItem = item.name.toLowerCase().includes('print') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('dtf') || item.name.toLowerCase().includes('banner');
                              if (!isPrintItem) return null;
                              
                              return (
                                  <tr key={index}>
                                      <td className="px-4 py-3 font-medium text-black">{item.name}</td>
                                      <td className="px-4 py-3">
                                          <SearchableMaterialSelect 
                                            items={stockItems}
                                            value={usageEntries[index]?.skuId || ''}
                                            onChange={(skuId) => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], skuId } }))}
                                          />
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            value={usageEntries[index]?.meters || ''} 
                                            placeholder="0.0"
                                            onChange={e => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], meters: parseFloat(e.target.value) || 0 } }))}
                                            className="block w-20 ml-auto text-right text-xs rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 font-mono font-bold text-black"
                                          />
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button onClick={() => setIsUsageModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 mr-4 font-medium">Cancel</button>
                  <button onClick={handleSaveUsage} className="bg-purple-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-purple-700 font-bold transition-all transform hover:scale-105">
                      Save & Complete Usage Log
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default DashboardView;
