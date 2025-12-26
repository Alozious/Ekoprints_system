
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sale, InventoryItem, Customer, User, SaleItem, StockItem, PricingTier, Payment } from '../types';
import { ChevronDownIcon, SearchIcon, PlusIcon, TrashIcon, EditIcon, DocumentTextIcon, BanknotesIcon, BeakerIcon } from './icons';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Invoice from './Invoice';
import { useToast } from '../App';
import { v4 as uuidv4 } from 'uuid';

interface SalesViewProps {
  sales: Sale[];
  inventory: InventoryItem[];
  customers: Customer[];
  currentUser: User;
  users: User[];
  quoteForSale: SaleItem[];
  clearQuote: () => void;
  onAddSale: (saleData: Omit<Sale, 'id'>) => Promise<void>;
  onDeleteSale: (sale: Sale) => Promise<void>;
  onUpdateSale: (sale: Sale) => Promise<void>;
  onAddCustomer: (customerData: Omit<Customer, 'id' | 'createdAt'>) => Promise<void | Customer>;
  stockItems: StockItem[];
  pricingTiers: PricingTier[];
  onStockOut: (skuId: string, metersUsed: number, jobId: string, notes: string) => Promise<void>;
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

/**
 * Custom Searchable Select for Materials Logging (Reuse logic for consistency)
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
                                    <span className="text-gray-400 font-mono">({i.totalStockMeters.toFixed(1)}m)</span>
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

const SalesView: React.FC<SalesViewProps> = ({ 
  sales, inventory, customers, currentUser, users, quoteForSale, clearQuote,
  onAddSale, onDeleteSale, onUpdateSale, onAddCustomer, stockItems, onStockOut
}) => {
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<(Sale & { customer: Customer }) | null>(null);
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [saleForUsage, setSaleForUsage] = useState<Sale | null>(null);
  const [usageEntries, setUsageEntries] = useState<{[key: string]: { skuId: string, meters: number }}>({});
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');

  // Filters State
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterUser, setFilterUser] = useState<string>('All');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { addToast } = useToast();

  useEffect(() => {
    if (quoteForSale.length > 0) {
      setIsAddSaleOpen(true);
    }
  }, [quoteForSale]);

  const totalQuote = useMemo(() => quoteForSale.reduce((sum, item) => sum + item.price * item.quantity, 0), [quoteForSale]);

  const handleCreateSale = async () => {
    if (!customerId) return;
    const saleData: Omit<Sale, 'id'> = {
      date: new Date().toISOString(),
      items: quoteForSale,
      customerId,
      total: totalQuote,
      amountPaid,
      status: amountPaid >= totalQuote ? 'Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid',
      userId: currentUser.id,
      userName: currentUser.username,
      payments: amountPaid > 0 ? [{
          id: uuidv4(),
          date: new Date().toISOString(),
          amount: amountPaid,
          recordedBy: currentUser.username,
          note: 'Initial payment'
      }] : []
    };
    await onAddSale(saleData);
    clearQuote();
    setCustomerId('');
    setAmountPaid(0);
    setIsAddSaleOpen(false);
  };

  const handleOpenPayment = (sale: Sale) => {
      setPayingSale(sale);
      setPaymentAmount(sale.total - (sale.amountPaid || 0));
      setPaymentNote('');
      setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payingSale || paymentAmount <= 0) return;

    const newAmountPaid = (payingSale.amountPaid || 0) + paymentAmount;
    const newStatus = newAmountPaid >= payingSale.total ? 'Paid' : 'Partially Paid';
    
    const newPayment: Payment = {
        id: uuidv4(),
        date: new Date().toISOString(),
        amount: paymentAmount,
        recordedBy: currentUser.username,
        note: paymentNote
    };

    const updatedSale: Sale = {
        ...payingSale,
        amountPaid: newAmountPaid,
        status: newStatus,
        payments: [...(payingSale.payments || []), newPayment]
    };

    await onUpdateSale(updatedSale);
    addToast(`Payment of ${formatUGX(paymentAmount)} recorded for Invoice #${payingSale.id.substring(0,8)}`, 'success');
    setIsPaymentModalOpen(false);
    setPayingSale(null);
  };

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
        addToast(`Inventory updated for Invoice #${saleForUsage.id.substring(0,8)}`, "success");
    }
    
    setIsUsageModalOpen(false);
    setSaleForUsage(null);
  };

  const handleViewInvoice = (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    if (customer) {
      setSelectedSale({ ...sale, customer });
      setIsInvoiceOpen(true);
    }
  };

  const isLoggable = (sale: Sale) => {
      if (sale.usageLogged) return false;
      return sale.items.some(item => 
          item.name.toLowerCase().includes('print') || 
          item.name.toLowerCase().includes('roll') ||
          item.name.toLowerCase().includes('dtf') ||
          item.name.toLowerCase().includes('banner')
      );
  };

  const filteredSales = useMemo(() => {
    let list = sales;
    
    // User Restriction: non-admins only see today's sales
    if (currentUser.role !== 'admin') {
      const today = new Date().toDateString();
      list = list.filter(s => s.userId === currentUser.id && new Date(s.date).toDateString() === today);
    } else {
      // Admin Filters
      if (filterUser !== 'All') {
        list = list.filter(s => s.userId === filterUser);
      }
    }

    // Status Filter
    if (filterStatus !== 'All') {
        list = list.filter(s => s.status === filterStatus);
    }

    // Date Range Filter
    if (filterDateStart) {
        const start = new Date(filterDateStart);
        start.setHours(0,0,0,0);
        list = list.filter(s => new Date(s.date) >= start);
    }
    if (filterDateEnd) {
        const end = new Date(filterDateEnd);
        end.setHours(23,59,59,999);
        list = list.filter(s => new Date(s.date) <= end);
    }

    // Search Query (Invoice ID or Customer Name)
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        list = list.filter(s => {
            const customerName = customers.find(c => c.id === s.customerId)?.name.toLowerCase() || '';
            const invoiceId = s.id.toLowerCase();
            return invoiceId.includes(query) || customerName.includes(query);
        });
    }

    return list;
  }, [sales, currentUser, filterStatus, filterUser, filterDateStart, filterDateEnd, searchQuery, customers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Sales Records</h2>
        <button 
          onClick={() => setIsAddSaleOpen(true)} 
          className="bg-yellow-500 text-[#1A2232] px-6 py-2.5 rounded-xl font-black flex items-center shadow-lg hover:bg-yellow-600 transition-all active:scale-95 uppercase tracking-widest text-xs"
        >
          <PlusIcon className="w-5 h-5 mr-2" /> New Sale
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">Search Invoice/Customer</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Type ID or Name..." 
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
            </div>

            <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">Payment Status</label>
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                >
                    <option value="All">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Unpaid">Unpaid</option>
                </select>
            </div>

            {currentUser.role === 'admin' && (
                <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">Created By</label>
                    <select 
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                    >
                        <option value="All">All Users</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">From Date</label>
                <input 
                    type="date" 
                    value={filterDateStart}
                    onChange={e => setFilterDateStart(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                />
            </div>

            <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">To Date</label>
                <input 
                    type="date" 
                    value={filterDateEnd}
                    onChange={e => setFilterDateEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                />
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-400 uppercase font-black text-[10px] tracking-widest">
            <tr>
              <th className="px-6 py-5">Invoice ID</th>
              <th className="px-6 py-5">Customer</th>
              <th className="px-6 py-5">Date & Time</th>
              <th className="px-6 py-5 text-right">Total</th>
              <th className="px-6 py-5 text-center">Status</th>
              <th className="px-6 py-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredSales.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4 font-mono font-bold text-blue-600">#{sale.id.substring(0, 8).toUpperCase()}</td>
                <td className="px-6 py-4 font-black text-black">{customers.find(c => c.id === sale.customerId)?.name || 'Guest'}</td>
                <td className="px-6 py-4 text-black font-bold text-[11px]">
                    {new Date(sale.date).toLocaleDateString([], { dateStyle: 'short' })}
                    <span className="block text-[9px] text-gray-500 font-medium">
                        {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </td>
                <td className="px-6 py-4 text-right font-black text-black">{formatUGX(sale.total)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    sale.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                    sale.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => handleViewInvoice(sale)} className="p-2 text-black hover:text-blue-600 transition-colors bg-blue-50 rounded-lg" title="View Invoice"><DocumentTextIcon className="w-5 h-5" /></button>
                    {sale.status !== 'Paid' && (
                        <button onClick={() => handleOpenPayment(sale)} className="p-2 text-black hover:text-green-600 transition-colors bg-green-50 rounded-lg" title="Add Payment"><BanknotesIcon className="w-5 h-5" /></button>
                    )}
                    {isLoggable(sale) && (
                        <button onClick={() => handleOpenUsageModal(sale)} className="p-2 text-red-600 hover:text-red-700 transition-colors bg-red-50 rounded-lg animate-blink" title="Log Usage (Urgent)"><BeakerIcon className="w-5 h-5" /></button>
                    )}
                    {currentUser.role === 'admin' && (
                       <button onClick={() => { setSaleToDelete(sale); setIsConfirmDeleteOpen(true); }} className="p-2 text-black hover:text-red-600 transition-colors bg-red-50 rounded-lg" title="Delete Record"><TrashIcon className="w-5 h-5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No sales records found</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Usage Log Modal */}
      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Log Printing Usage">
          <div className="space-y-6">
              <p className="text-sm text-black font-medium bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  Select the material roll used and enter the printed meters for <strong>Invoice #{saleForUsage?.id.substring(0,8).toUpperCase()}</strong>.
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-black font-black uppercase text-[10px]">
                          <tr>
                              <th className="px-4 py-3">Invoice Item</th>
                              <th className="px-4 py-3">Roll Material</th>
                              <th className="px-4 py-3 text-right">Meters</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                          {saleForUsage?.items.map((item, index) => {
                              const isPrintItem = item.name.toLowerCase().includes('print') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('dtf') || item.name.toLowerCase().includes('banner');
                              if (!isPrintItem) return null;
                              return (
                                  <tr key={index}>
                                      <td className="px-4 py-3 font-bold text-black text-xs">{item.name}</td>
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
                                            placeholder="0.00"
                                            onChange={e => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], meters: parseFloat(e.target.value) || 0 } }))}
                                            className="block w-20 ml-auto text-right text-sm rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 font-black text-black"
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
                className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-gray-800 transition-all active:scale-95"
              >
                Save Log & Deduct Inventory
              </button>
          </div>
      </Modal>

      <Modal isOpen={isAddSaleOpen} onClose={() => { setIsAddSaleOpen(false); clearQuote(); }} title="Confirm New Sale">
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Assign Customer</label>
            <select 
                value={customerId} 
                onChange={e => setCustomerId(e.target.value)} 
                className="w-full p-3 border border-gray-200 rounded-xl bg-white text-black font-bold focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all" 
                required
            >
                <option value="">Select Customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-3">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Order Summary</p>
             {quoteForSale.map((item, i) => (
               <div key={i} className="flex justify-between items-start text-sm">
                 <span className="text-black font-bold leading-tight flex-1 pr-4">{item.name} <span className="text-gray-500 font-medium">x {item.quantity}</span></span>
                 <strong className="text-black font-black whitespace-nowrap">{formatUGX(item.price * item.quantity)}</strong>
               </div>
             ))}
             <div className="pt-4 mt-2 border-t border-gray-200 flex justify-between items-baseline">
               <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Payable</span>
               <span className="text-3xl font-black text-blue-800 tracking-tighter">{formatUGX(totalQuote)}</span>
             </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Amount Received (UGX)</label>
            <input 
              type="number" 
              value={amountPaid || ''} 
              onChange={e => setAmountPaid(parseInt(e.target.value) || 0)} 
              className="w-full p-4 border border-gray-200 rounded-xl bg-white text-black font-black text-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
              placeholder="0"
            />
          </div>

          <button 
            onClick={handleCreateSale} 
            disabled={!customerId || quoteForSale.length === 0}
            className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            Finalize Invoice
          </button>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setPayingSale(null); }} title="Record Payment">
        <div className="space-y-6">
            {payingSale && (
                <>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                             <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Invoice #{payingSale.id.substring(0,8)}</span>
                             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${payingSale.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{payingSale.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-[9px] font-black text-gray-400 uppercase">Total Due</p>
                                 <p className="text-lg font-black text-black">{formatUGX(payingSale.total)}</p>
                             </div>
                             <div>
                                 <p className="text-[9px] font-black text-gray-400 uppercase">Already Paid</p>
                                 <p className="text-lg font-black text-green-600">{formatUGX(payingSale.amountPaid || 0)}</p>
                             </div>
                             <div className="col-span-2 pt-3 border-t border-gray-200">
                                 <p className="text-[9px] font-black text-gray-400 uppercase">Current Balance</p>
                                 <p className="text-2xl font-black text-red-600">{formatUGX(payingSale.total - (payingSale.amountPaid || 0))}</p>
                             </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Payment Amount (UGX)</label>
                        <input 
                            type="number" 
                            value={paymentAmount || ''} 
                            onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} 
                            className="w-full p-4 border border-gray-200 rounded-xl bg-white text-black font-black text-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                            placeholder="0"
                        />
                    </div>

                    <button 
                        onClick={handleRecordPayment} 
                        className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Confirm Payment
                    </button>
                </>
            )}
        </div>
      </Modal>

      {selectedSale && <Invoice isOpen={isInvoiceOpen} onClose={() => setIsInvoiceOpen(false)} sale={selectedSale} />}
      
      <ConfirmationModal 
        isOpen={isConfirmDeleteOpen} 
        onClose={() => setIsConfirmDeleteOpen(false)} 
        onConfirm={() => saleToDelete && onDeleteSale(saleToDelete)} 
        title="Delete Sale Record" 
        message="This will permanently delete the sale record. Continue?" 
      />
    </div>
  );
};

export default SalesView;