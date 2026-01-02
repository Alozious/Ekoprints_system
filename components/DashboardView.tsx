
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Sale, Expense, StockItem, User, SaleItem, Payment } from '../types';
import { 
    AlertTriangleIcon, 
    BeakerIcon, 
    ChevronDownIcon, 
    SearchIcon, 
    SalesIcon, 
    ExpensesIcon, 
    BanknotesIcon, 
    InventoryIcon,
    PlusIcon,
    TaskIcon,
    ArrowUpCircleIcon,
    ArrowDownCircleIcon
} from './icons';
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
            String(i.width).includes(s)
        );
    }, [items, search]);

    const selectedItem = items.find(i => i.skuId === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm text-left bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-black font-bold transition-all"
            >
                <span className="truncate">
                    {selectedItem ? `${selectedItem.width}m | ${selectedItem.itemName}` : "Select Material..."}
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-100">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-3 py-2 text-xs text-black border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                placeholder="Search materials..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <ul className="max-h-60 overflow-auto py-1 scrollbar-thin">
                        {filtered.length > 0 ? (
                            filtered.map(i => (
                                <li
                                    key={i.skuId}
                                    onClick={() => {
                                        onChange(i.skuId);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="px-5 py-3 text-xs text-black hover:bg-yellow-50 cursor-pointer flex justify-between items-center transition-colors"
                                >
                                    <span className="font-bold">{i.itemName} <span className="text-gray-400 font-normal ml-1">({i.width}m)</span></span>
                                    <span className="text-gray-400 font-black text-[10px]">{(i.totalStockMeters || 0).toFixed(1)}m left</span>
                                </li>
                            ))
                        ) : (
                            <li className="px-5 py-8 text-xs text-center text-gray-400 font-bold uppercase">No materials found</li>
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
  
  const { relevantSales, relevantExpenses, relevantCollections } = useMemo(() => {
      const today = new Date().toDateString();
      let filteredSales = sales;
      let filteredExpenses = expenses;
      let filteredPayments = sales.flatMap(s => s.payments || []);

      if (currentUser.role === 'user') {
          filteredSales = sales.filter(s => s.userId === currentUser.id && new Date(s.date).toDateString() === today);
          filteredExpenses = expenses.filter(e => e.userId === currentUser.id && new Date(e.date).toDateString() === today);
          filteredPayments = filteredPayments.filter(p => p.recordedBy === currentUser.username && new Date(p.date).toDateString() === today);
      } else {
          // Admin sees all for today by default or global depending on view
          filteredSales = sales.filter(s => new Date(s.date).toDateString() === today);
          filteredExpenses = expenses.filter(e => new Date(e.date).toDateString() === today);
          filteredPayments = filteredPayments.filter(p => new Date(p.date).toDateString() === today);
      }

      return { 
          relevantSales: filteredSales, 
          relevantExpenses: filteredExpenses,
          relevantCollections: filteredPayments
      };
  }, [sales, expenses, currentUser]);

  const totalRevenueToday = relevantSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalCollectionsToday = relevantCollections.reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpensesToday = relevantExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netCashFlowToday = totalCollectionsToday - totalExpensesToday;
  
  const totalMaterialsValue = currentUser.role === 'admin' 
      ? stockItems.reduce((sum, item) => sum + ((item.totalStockMeters || 0) / ROLL_LENGTH_METERS) * item.lastPurchasePricePerRoll_UGX, 0) 
      : 0;

  const salesTrendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toDateString();
    }).reverse();

    return last7Days.map(dateStr => {
        const dayPayments = sales.flatMap(s => s.payments || []).filter(p => new Date(p.date).toDateString() === dateStr);
        return {
            name: new Date(dateStr).toLocaleDateString([], { weekday: 'short' }),
            collections: dayPayments.reduce((sum, p) => sum + p.amount, 0)
        };
    });
  }, [sales]);
    
  const lowStockItems = stockItems.filter(item => (item.totalStockMeters || 0) <= item.reorderLevel);

  const StatCard = ({ title, value, colorClass, icon, trend, sub }: { title: string; value: string; colorClass: string, icon: React.ReactNode, trend?: string, sub?: string }) => (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-4 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform duration-500`}>
              {icon}
            </div>
            {trend && (
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend.startsWith('+') ? <ArrowUpCircleIcon className="w-3 h-3 mr-1" /> : <ArrowDownCircleIcon className="w-3 h-3 mr-1" />}
                    {trend}
                </div>
            )}
        </div>
        <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{title}</h3>
            <p className="text-3xl font-black text-[#1A2232] tracking-tighter leading-none">{value}</p>
            {sub && <p className="text-[9px] text-gray-400 font-bold uppercase mt-2 opacity-60">{sub}</p>}
        </div>
        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-gray-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
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
    const entries = Object.entries(usageEntries) as [string, { skuId: string, meters: number }][];
    for (const [index, entry] of entries) {
        if (entry.skuId && entry.meters > 0) {
            await onStockOut(entry.skuId, entry.meters, `INV-${saleForUsage.id.substring(0,8)}`, `Consumption Log`);
            processedCount++;
        }
    }
    if (processedCount > 0) {
        await onUpdateSale({ ...saleForUsage, usageLogged: true });
        addToast(`Inventory sync complete for INV-${saleForUsage.id.substring(0,8)}`, "success");
    }
    setIsUsageModalOpen(false);
    setSaleForUsage(null);
  };

  return (
    <div className="fade-in space-y-10">
      
      {/* Dynamic Urgent Actions Panel */}
      {pendingLogs.length > 0 && (
        <div className="bg-[#1A2232] rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex items-center">
                    <div className="bg-yellow-400 p-6 rounded-[2rem] mr-8 shadow-[0_20px_40px_-10px_rgba(251,191,36,0.5)]">
                        <BeakerIcon className="w-12 h-12 text-[#1A2232]" />
                    </div>
                    <div>
                        <h3 className="text-white font-black text-2xl uppercase tracking-tight mb-2">Pending Consumption Audit</h3>
                        <p className="text-gray-400 font-bold text-sm max-w-md">There are <span className="text-yellow-400">{pendingLogs.length} recent transactions</span> that haven't had their material usage logged yet. Please calibrate stock levels.</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenUsageModal(pendingLogs[0])}
                    className="bg-yellow-400 text-[#1A2232] px-12 py-5 rounded-3xl font-black shadow-2xl hover:bg-yellow-500 transition-all active:scale-95 flex items-center justify-center uppercase tracking-[0.2em] text-xs shrink-0"
                >
                    Authorize Batch Log
                </button>
            </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
        <div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none">Command Center</h2>
            <p className="text-gray-400 text-xs font-black uppercase tracking-[0.4em] mt-3 ml-1">{currentUser.role === 'admin' ? 'Enterprise Monitoring' : `Session Log: ${currentUser.username}`}</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">{new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="Invoiced Value" value={formatUGX(totalRevenueToday)} colorClass="bg-blue-50 text-blue-600" icon={<SalesIcon className="w-7 h-7" />} sub="New Bills Issued Today" />
        <StatCard title="Total Collected" value={formatUGX(totalCollectionsToday)} colorClass="bg-emerald-50 text-emerald-600" icon={<BanknotesIcon className="w-7 h-7" />} sub="Cash In (Includes Debt Recovery)" />
        <StatCard title="Net Daily Flow" value={formatUGX(netCashFlowToday)} colorClass="bg-amber-50 text-amber-600" icon={<ArrowUpCircleIcon className="w-7 h-7" />} sub="Cash In vs. Today's Expenses" />
        {currentUser.role === 'admin' ? (
            <StatCard title="Asset Value (Raw)" value={formatUGX(totalMaterialsValue)} colorClass="bg-purple-50 text-purple-600" icon={<InventoryIcon className="w-7 h-7" />} />
        ) : (
            <StatCard title="Daily Expenses" value={formatUGX(totalExpensesToday)} colorClass="bg-rose-50 text-rose-600" icon={<ExpensesIcon className="w-7 h-7" />} />
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl border border-gray-50 flex flex-col">
           <div className="flex justify-between items-center mb-10">
               <div>
                   <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Collections Trend</h3>
                   <p className="text-xl font-black text-gray-900 uppercase">Actual Cash / Last 7 Days</p>
               </div>
               <div className="flex gap-2">
                   <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl">
                       <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cash Collections</span>
                   </div>
               </div>
           </div>
           <div className="flex-1 min-h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrendData}>
                        <defs>
                            <linearGradient id="colorCol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} tick={{dy: 15}} />
                        <YAxis tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} stroke="#cbd5e1" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '16px' }}
                            itemStyle={{ color: '#1e293b', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase' }}
                            cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }}
                        />
                        <Area type="monotone" dataKey="collections" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorCol)" />
                    </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-50 flex flex-col">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Replenishment Audit</h3>
            <div className="flex-1 space-y-6">
                {lowStockItems.length > 0 ? (
                    lowStockItems.slice(0, 8).map(item => (
                        <div key={item.skuId} className="flex items-center justify-between group p-3 hover:bg-rose-50 rounded-2xl transition-colors">
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mr-4 group-hover:bg-rose-100 transition-colors">
                                    <AlertTriangleIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-900 uppercase tracking-tight truncate max-w-[120px]">{item.itemName}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase">Threshold: {item.reorderLevel}m</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-rose-600 leading-none">{(item.totalStockMeters || 0).toFixed(1)}m</p>
                                <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mt-1">Remaining</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                        <InventoryIcon className="w-20 h-20 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Inventory Levels Healthy</p>
                    </div>
                )}
            </div>
            {lowStockItems.length > 8 && (
                <button className="mt-8 w-full py-4 rounded-2xl bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-100 transition-colors">
                    View All {lowStockItems.length} Alerts
                </button>
            )}
        </div>
      </div>

      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Material Consumption Calibration">
          <div className="space-y-8">
              <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 flex items-center gap-6">
                  <div className="bg-blue-600 p-4 rounded-2xl shadow-xl"><BeakerIcon className="w-8 h-8 text-white" /></div>
                  <p className="text-sm text-blue-900 font-bold leading-relaxed">
                      Confirm machine yield for <strong className="text-blue-600">INV-#{saleForUsage?.id.substring(0,8).toUpperCase()}</strong>. Accurate data ensures seamless stock replenishment.
                  </p>
              </div>
              
              <div className="border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                              <th className="px-8 py-5">Job Item</th>
                              <th className="px-8 py-5">Material Roll</th>
                              <th className="px-8 py-5 text-right">Yield Used (m)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {saleForUsage?.items.map((item, index) => {
                              const isPrintItem = item.name.toLowerCase().includes('print') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('dtf') || item.name.toLowerCase().includes('banner');
                              if (!isPrintItem) return null;
                              
                              return (
                                  <tr key={index}>
                                      <td className="px-8 py-6 font-black text-gray-800 text-xs uppercase max-w-[150px] truncate">{item.name}</td>
                                      <td className="px-8 py-6 min-w-[200px]">
                                          <SearchableMaterialSelect 
                                            items={stockItems}
                                            value={usageEntries[index]?.skuId || ''}
                                            onChange={(skuId) => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], skuId } }))}
                                          />
                                      </td>
                                      <td className="px-8 py-6 text-right">
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            value={usageEntries[index]?.meters || ''} 
                                            placeholder="0.00"
                                            onChange={e => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], meters: parseFloat(e.target.value) || 0 } }))}
                                            className="block w-28 ml-auto text-right text-sm rounded-xl border-gray-200 bg-gray-50 shadow-inner focus:ring-2 focus:ring-blue-500 font-black text-blue-700 p-3"
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
                className="w-full bg-[#1A2232] text-yellow-400 py-6 rounded-[2rem] font-black uppercase tracking-[0.25em] text-xs shadow-2xl hover:bg-gray-800 transition-all active:scale-95 border border-yellow-400/10"
              >
                Sync Stock Database
              </button>
          </div>
      </Modal>
    </div>
  );
};

export default DashboardView;
