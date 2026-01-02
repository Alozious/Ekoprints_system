
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sale, InventoryItem, Customer, User, SaleItem, StockItem, PricingTier, Payment, Task } from '../types';
import { ChevronDownIcon, SearchIcon, PlusIcon, TrashIcon, EditIcon, DocumentTextIcon, BanknotesIcon, BeakerIcon, TaskIcon } from './icons';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Invoice from './Invoice';
import { useToast } from '../App';
import { v4 as uuidv4 } from 'uuid';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface SalesViewProps {
  sales: Sale[];
  inventory: InventoryItem[];
  customers: Customer[];
  currentUser: User;
  users: User[];
  quoteForSale: SaleItem[];
  quoteNarration?: string;
  quoteDiscount: number;
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

const SearchableCustomerSelect: React.FC<{
    customers: Customer[];
    value: string;
    onChange: (id: string) => void;
    onAddNew: (name: string, phone: string, address: string) => Promise<void>;
}> = ({ customers, value, onChange, onAddNew }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [quickPhone, setQuickPhone] = useState('');
    const [quickAddress, setQuickAddress] = useState('');
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
        if (!search) return customers;
        const s = search.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(s) || 
            c.phone?.toLowerCase().includes(s)
        );
    }, [customers, search]);

    const selectedCustomer = customers.find(c => c.id === value);

    const handleCreateNew = async () => {
        if (!search.trim()) return;
        setIsCreating(true);
        await onAddNew(search.trim(), quickPhone.trim(), quickAddress.trim());
        setIsCreating(false);
        setSearch('');
        setQuickPhone('');
        setQuickAddress('');
        setIsOpen(false);
    };

    const inputStyle = "w-full px-4 py-3 text-sm text-black border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white placeholder-gray-300 font-bold";

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full p-4 border border-gray-200 rounded-2xl bg-white text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all shadow-sm"
            >
                <span className="truncate">
                    {selectedCustomer ? selectedCustomer.name : "Assign to Customer..."}
                </span>
                <ChevronDownIcon className="w-6 h-6 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <div className="relative">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-3 text-sm text-black border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white shadow-inner"
                                placeholder="Search by name or phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <ul className="max-h-64 overflow-auto py-2 scrollbar-thin">
                        {filtered.length > 0 ? (
                            filtered.map(c => (
                                <li
                                    key={c.id}
                                    onClick={() => {
                                        onChange(c.id);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="px-6 py-4 text-sm text-black hover:bg-yellow-50 cursor-pointer flex flex-col border-b border-gray-50 last:border-0"
                                >
                                    <span className="font-bold text-gray-900">{c.name}</span>
                                    {c.phone && <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">{c.phone}</span>}
                                </li>
                            ))
                        ) : search ? (
                            <li className="p-6 space-y-4 bg-gray-50/50">
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-4">Customer Registry Gap</p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Phone Contact</label>
                                        <input type="text" placeholder="e.g. 0700 000 000" value={quickPhone} onChange={e => setQuickPhone(e.target.value)} className={inputStyle} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Work/Home Address</label>
                                        <input type="text" placeholder="e.g. Masaka City" value={quickAddress} onChange={e => setQuickAddress(e.target.value)} className={inputStyle} />
                                    </div>
                                </div>
                                <button
                                    onClick={handleCreateNew}
                                    disabled={isCreating}
                                    className="w-full bg-yellow-400 text-gray-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-xl active:scale-95 border border-yellow-500/10"
                                >
                                    {isCreating ? 'Authenticating...' : `Enroll "${search}" as New`}
                                </button>
                            </li>
                        ) : (
                            <li className="px-6 py-12 text-center text-xs text-gray-300 font-black uppercase tracking-[0.3em]">No results found</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

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
                className="flex items-center justify-between w-full px-4 py-3 text-sm text-left bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 text-black font-bold"
            >
                <span className="truncate">
                    {selectedItem ? `${selectedItem.width}m | ${selectedItem.itemName}` : "Select Source Roll..."}
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
                                className="w-full pl-10 pr-3 py-2 text-xs text-black border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                placeholder="Search dimensions..."
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
                                    className="px-5 py-3 text-xs text-black hover:bg-yellow-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                >
                                    <span className="font-bold"><strong>{i.width}m</strong> | {i.itemName}</span>
                                    <span className="text-gray-400 font-black text-[10px]">({(i.totalStockMeters || 0).toFixed(1)}m)</span>
                                </li>
                            ))
                        ) : (
                            <li className="px-5 py-8 text-xs text-center text-gray-400 font-bold uppercase">No matching rolls</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

const SalesView: React.FC<SalesViewProps> = ({ 
  sales, inventory, customers, currentUser, users, quoteForSale, quoteNarration, quoteDiscount, clearQuote,
  onAddSale, onDeleteSale, onUpdateSale, onAddCustomer, stockItems, onStockOut
}) => {
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isNarrationModalOpen, setIsNarrationModalOpen] = useState(false);
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  
  const [selectedSale, setSelectedSale] = useState<(Sale & { customer: Customer }) | null>(null);
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [saleForUsage, setSaleForUsage] = useState<Sale | null>(null);
  const [saleForNarration, setSaleForNarration] = useState<Sale | null>(null);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [saleForTask, setSaleForTask] = useState<Sale | null>(null);
  
  const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
  const [editedDiscount, setEditedDiscount] = useState(0);
  const [editedNarration, setEditedNarration] = useState('');
  
  // Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');

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

  const subtotalQuote = useMemo(() => quoteForSale.reduce((sum, item) => sum + item.price * item.quantity, 0), [quoteForSale]);
  const totalQuote = subtotalQuote - quoteDiscount;

  const handleCreateSale = async () => {
    if (!customerId) return;
    const saleData: Omit<Sale, 'id'> = {
      date: new Date().toISOString(),
      items: quoteForSale,
      customerId,
      subtotal: subtotalQuote,
      discount: quoteDiscount,
      total: totalQuote,
      amountPaid,
      status: amountPaid >= totalQuote ? 'Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid',
      userId: currentUser.id,
      userName: currentUser.username,
      notes: quoteNarration || '',
      payments: amountPaid > 0 ? [{
          id: uuidv4(),
          date: new Date().toISOString(),
          amount: amountPaid,
          recordedBy: currentUser.username,
          note: 'Deposit'
      }] : []
    };
    await onAddSale(saleData);
    clearQuote();
    setCustomerId('');
    setAmountPaid(0);
    setIsAddSaleOpen(false);
  };

  const handleOpenAssignTask = (sale: Sale) => {
    setSaleForTask(sale);
    setTaskTitle(`Produce Items for Invoice #${sale.id.substring(0,8).toUpperCase()}`);
    setTaskDesc(`Job linked to customer: ${customers.find(c => c.id === sale.customerId)?.name || 'Guest'}`);
    setTaskAssignee('');
    setTaskDeadline('');
    setIsAssignTaskModalOpen(true);
  };

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssignee || !taskDeadline || !saleForTask) return;
    
    const assignee = users.find(u => u.id === taskAssignee);
    const taskData: Omit<Task, 'id'> = {
        title: taskTitle,
        description: taskDesc,
        assignedTo: taskAssignee,
        assignedToName: assignee?.username || 'Unknown',
        assignedBy: currentUser.id,
        saleId: saleForTask.id,
        deadline: new Date(taskDeadline).toISOString(),
        status: 'Pending',
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'tasks'), taskData);
        addToast("Production task assigned.", "success");
        setIsAssignTaskModalOpen(false);
    } catch (err) {
        addToast("Task assignment failed.", "error");
    }
  };

  const handleQuickAddCustomer = async (name: string, phone: string, address: string) => {
    try {
        const newCustomer = await onAddCustomer({
            name,
            email: `${name.toLowerCase().replace(/\s+/g, '.')}@guest.com`,
            phone: phone || '',
            address: address || ''
        });
        if (newCustomer) {
            setCustomerId(newCustomer.id);
            addToast(`Customer "${name}" registered and assigned.`, 'success');
        }
    } catch (e) {
        addToast("Registry failure. Try again.", "error");
    }
  };

  const handleOpenNarration = (sale: Sale) => {
      setSaleForNarration(sale);
      setEditedNarration(sale.notes || '');
      setIsNarrationModalOpen(true);
  };

  const handleSaveNarration = async () => {
      if (saleForNarration) {
          await onUpdateSale({ ...saleForNarration, notes: editedNarration });
          addToast("Internal narration updated successfully.", "success");
          setIsNarrationModalOpen(false);
          setSaleForNarration(null);
      }
  };

  const handleOpenEditInvoice = (sale: Sale) => {
      setSaleToEdit(sale);
      setEditedItems([...sale.items]);
      setEditedDiscount(sale.discount || 0);
      setEditedNarration(sale.notes || '');
      setIsEditInvoiceModalOpen(true);
  };

  const handleUpdateItemInEdit = (index: number, field: keyof SaleItem, value: any) => {
      const newList = [...editedItems];
      newList[index] = { ...newList[index], [field]: value };
      setEditedItems(newList);
  };

  const handleRemoveItemInEdit = (index: number) => {
      setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveInvoiceEdit = async () => {
      if (!saleToEdit) return;
      if (editedItems.length === 0) {
          addToast("Invoice must contain at least one item. Use delete to remove entire sale.", "error");
          return;
      }
      
      const newSubtotal = editedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newTotal = newSubtotal - editedDiscount;
      const paid = saleToEdit.amountPaid || 0;
      const newStatus = paid >= newTotal ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid';
      
      const updatedSale: Sale = {
          ...saleToEdit,
          items: editedItems,
          subtotal: newSubtotal,
          discount: editedDiscount,
          total: newTotal,
          status: newStatus,
          notes: editedNarration
      };
      
      await onUpdateSale(updatedSale);
      addToast("Invoice contents updated successfully.", "success");
      setIsEditInvoiceModalOpen(false);
      setSaleToEdit(null);
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
    addToast(`Payment of ${formatUGX(paymentAmount)} received.`, 'success');
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
                `INV-${saleForUsage.id.substring(0,8)}`, 
                `Consumption for ${item.name}`
            );
            processedCount++;
        }
    }

    if (processedCount > 0) {
        await onUpdateSale({
            ...saleForUsage,
            usageLogged: true
        });
        addToast(`Machine consumption logged for #${saleForUsage.id.substring(0,8)}`, "success");
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
    
    if (currentUser.role !== 'admin') {
      const today = new Date().toDateString();
      list = list.filter(s => s.userId === currentUser.id && new Date(s.date).toDateString() === today);
    } else {
      if (filterUser !== 'All') {
        list = list.filter(s => s.userId === filterUser);
      }
    }

    if (filterStatus !== 'All') {
        list = list.filter(s => s.status === filterStatus);
    }

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

  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Sales Operations</h2>
        <button 
          onClick={() => setIsAddSaleOpen(true)} 
          className="bg-yellow-500 text-[#1A2232] px-8 py-3.5 rounded-2xl font-black flex items-center shadow-xl hover:bg-yellow-600 transition-all active:scale-95 uppercase tracking-widest text-xs border border-yellow-600/10"
        >
          <PlusIcon className="w-5 h-5 mr-3" /> New Transaction
        </button>
      </div>

      {/* Optimized Filters Area */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Quick Search</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Invoice # or Customer..." 
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    />
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Status</label>
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                >
                    <option value="All">All Statuses</option>
                    <option value="Paid">Fully Paid</option>
                    <option value="Partially Paid">Partial</option>
                    <option value="Unpaid">Arrears</option>
                </select>
            </div>

            {currentUser.role === 'admin' && (
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Sales Rep</label>
                    <select 
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    >
                        <option value="All">All Staff</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Start Date</label>
                <input 
                    type="date" 
                    value={filterDateStart}
                    onChange={e => setFilterDateStart(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                />
            </div>

            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">End Date</label>
                <input 
                    type="date" 
                    value={filterDateEnd}
                    onChange={e => setFilterDateEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                />
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-400 uppercase font-black text-[10px] tracking-[0.15em]">
            <tr>
              <th className="px-8 py-5">Invoice Ref</th>
              <th className="px-8 py-5">Client Name</th>
              <th className="px-8 py-5">Record Date</th>
              <th className="px-8 py-5 text-right">Value</th>
              <th className="px-8 py-5 text-center">Status</th>
              <th className="px-8 py-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredSales.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-8 py-4 font-mono font-bold text-blue-600 text-xs">#{sale.id.substring(0, 8).toUpperCase()}</td>
                <td className="px-8 py-4">
                    <p className="font-black text-gray-900 text-sm uppercase tracking-tight">{customers.find(c => c.id === sale.customerId)?.name || 'Guest User'}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Contact: {customers.find(c => c.id === sale.customerId)?.phone || '-'}</p>
                </td>
                <td className="px-8 py-4 text-gray-600 font-bold text-[11px]">
                    {new Date(sale.date).toLocaleDateString([], { dateStyle: 'medium' })}
                    <span className="block text-[10px] text-gray-400 font-medium mt-0.5 uppercase">
                        {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </td>
                <td className="px-8 py-4 text-right font-black text-gray-900 text-sm">{formatUGX(sale.total)}</td>
                <td className="px-8 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    sale.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                    sale.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-8 py-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => handleViewInvoice(sale)} className="p-2.5 text-gray-900 hover:text-blue-600 transition-all bg-blue-50/50 rounded-xl hover:scale-110" title="Review Invoice"><DocumentTextIcon className="w-5 h-5" /></button>
                    
                    {currentUser.role === 'admin' && (
                        <button onClick={() => handleOpenAssignTask(sale)} className="p-2.5 text-gray-900 hover:text-blue-600 transition-all bg-blue-50/50 rounded-xl hover:scale-110" title="Assign Production Task"><TaskIcon className="w-5 h-5" /></button>
                    )}

                    {currentUser.role === 'admin' ? (
                        <button onClick={() => handleOpenEditInvoice(sale)} className="p-2.5 text-gray-900 hover:text-orange-600 transition-all bg-orange-50/50 rounded-xl hover:scale-110" title="Edit Invoice Contents"><EditIcon className="w-5 h-5" /></button>
                    ) : (
                        <button onClick={() => handleOpenNarration(sale)} className="p-2.5 text-gray-900 hover:text-purple-600 transition-all bg-purple-50/50 rounded-xl hover:scale-110" title="Job Production Notes"><EditIcon className="w-5 h-5" /></button>
                    )}

                    {sale.status !== 'Paid' && (
                        <button onClick={() => handleOpenPayment(sale)} className="p-2.5 text-gray-900 hover:text-green-600 transition-all bg-green-50/50 rounded-xl hover:scale-110" title="Receive Payment"><BanknotesIcon className="w-5 h-5" /></button>
                    )}
                    {isLoggable(sale) && (
                        <button onClick={() => handleOpenUsageModal(sale)} className="p-2.5 text-red-600 hover:text-red-700 transition-all bg-red-50/50 rounded-xl animate-blink" title="Consumption Log (Urgent)"><BeakerIcon className="w-5 h-5" /></button>
                    )}
                    {currentUser.role === 'admin' && (
                       <button onClick={() => { setSaleToDelete(sale); setIsConfirmDeleteOpen(true); }} className="p-2.5 text-gray-900 hover:text-red-600 transition-all bg-red-50/50 rounded-xl hover:scale-110" title="Purge Record"><TrashIcon className="w-5 h-5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-8 py-24 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-xs">Zero transactional flow detected</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Task Assignment Modal */}
      <Modal isOpen={isAssignTaskModalOpen} onClose={() => setIsAssignTaskModalOpen(false)} title="Assign Production Task">
          <div className="space-y-6">
              <div>
                  <label className={labelStyle}>Task Title</label>
                  <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className={darkInput} placeholder="Assign a title..." />
              </div>
              <div>
                  <label className={labelStyle}>Job Detail</label>
                  <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className={`${darkInput} min-h-[100px] resize-none`} placeholder="Specific instructions..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className={labelStyle}>Assign To User</label>
                      <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} className={darkInput}>
                          <option value="">Select Staff...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className={labelStyle}>Completion Deadline</label>
                      <input type="datetime-local" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} className={darkInput} />
                  </div>
              </div>
              <button 
                  onClick={handleCreateTask}
                  disabled={!taskTitle || !taskAssignee || !taskDeadline}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                  Assign Production Ticket
              </button>
          </div>
      </Modal>

      {/* Admin Edit Invoice Modal - Powerful Inline Editor */}
      <Modal isOpen={isEditInvoiceModalOpen} onClose={() => setIsEditInvoiceModalOpen(false)} title="Administrative Invoice Editor">
          <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-orange-400 rounded-xl text-white shadow-sm"><EditIcon className="w-5 h-5"/></div>
                  <div>
                      <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest leading-none mb-1">Administrative Overide</p>
                      <p className="text-xs font-bold text-orange-600">Modifying Invoice: <strong className="text-gray-900">#{saleToEdit?.id.substring(0,8).toUpperCase()}</strong></p>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="overflow-hidden border border-gray-100 rounded-[1.8rem] shadow-sm bg-white">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              <tr>
                                  <th className="px-5 py-4">Item Name</th>
                                  <th className="px-5 py-4 w-20 text-center">Qty</th>
                                  <th className="px-5 py-4 w-32 text-right">Unit Price</th>
                                  <th className="px-5 py-4 w-12"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {editedItems.map((item, idx) => (
                                  <tr key={idx} className="group hover:bg-gray-50/50">
                                      <td className="px-5 py-4">
                                          <p className="font-black text-gray-900 text-xs uppercase tracking-tight leading-tight">{item.name}</p>
                                      </td>
                                      <td className="px-2 py-4">
                                          <input 
                                              type="number" 
                                              value={item.quantity}
                                              onChange={(e) => handleUpdateItemInEdit(idx, 'quantity', parseInt(e.target.value) || 1)}
                                              className="w-16 mx-auto text-center p-2 rounded-xl bg-gray-50 border-gray-100 font-black text-xs text-blue-600 focus:ring-2 focus:ring-blue-400 outline-none"
                                          />
                                      </td>
                                      <td className="px-2 py-4">
                                          <input 
                                              type="number" 
                                              value={item.price}
                                              onChange={(e) => handleUpdateItemInEdit(idx, 'price', parseInt(e.target.value) || 0)}
                                              className="w-28 ml-auto text-right p-2 rounded-xl bg-gray-50 border-gray-100 font-black text-xs text-gray-900 focus:ring-2 focus:ring-blue-400 outline-none"
                                          />
                                      </td>
                                      <td className="px-3 py-4 text-center">
                                          <button onClick={() => handleRemoveItemInEdit(idx)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-center">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Discount Amount (UGX)</label>
                          <input 
                              type="number" 
                              value={editedDiscount}
                              onChange={(e) => setEditedDiscount(parseInt(e.target.value) || 0)}
                              className="w-full p-2 bg-white border border-gray-200 rounded-xl font-black text-rose-600 text-sm focus:ring-2 focus:ring-rose-400 outline-none"
                          />
                      </div>
                      <div className="bg-[#1A2232] p-4 rounded-2xl text-right">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">New Total Payable</p>
                          <p className="text-xl font-black text-yellow-400 tracking-tighter">
                              {formatUGX(editedItems.reduce((s, i) => s + (i.price * i.quantity), 0) - editedDiscount)}
                          </p>
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Job Narration / Admin Notes</label>
                      <textarea 
                          value={editedNarration}
                          onChange={(e) => setEditedNarration(e.target.value)}
                          className="w-full p-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 text-xs font-bold text-gray-700 min-h-[100px] resize-none outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                          placeholder="Internal production updates..."
                      />
                  </div>
              </div>

              <button 
                  onClick={handleSaveInvoiceEdit}
                  className="w-full bg-blue-600 text-white py-5 rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all border border-blue-500/20"
              >
                  Update Invoice Contents
              </button>
          </div>
      </Modal>

      {/* Narration Modal - Production Details (Standard User View) */}
      <Modal isOpen={isNarrationModalOpen} onClose={() => setIsNarrationModalOpen(false)} title="Internal Production Tracking">
          <div className="space-y-6">
              <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">INVOICED BILLABLES</h4>
                  <div className="space-y-2">
                      {saleForNarration?.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs font-black tracking-tight uppercase">
                              <span className="text-gray-600">{item.name} <span className="text-gray-400 font-bold ml-1">x {item.quantity}</span></span>
                              <span className="text-gray-900">{formatUGX(item.price * item.quantity)}</span>
                          </div>
                      ))}
                  </div>
              </div>
              <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Job Narration / Workflow Notes</label>
                  <textarea 
                    value={editedNarration} 
                    onChange={e => setEditedNarration(e.target.value)}
                    className="w-full p-5 border-2 border-gray-100 rounded-[2rem] text-sm font-bold text-gray-900 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none min-h-[160px] resize-none shadow-inner"
                    placeholder="Document specific client requests, production steps, or machine settings here..."
                  />
                  <div className="mt-4 flex items-start gap-3 bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                      <div className="p-1.5 bg-yellow-400 rounded-lg shrink-0 mt-0.5"><BeakerIcon className="w-3.5 h-3.5 text-gray-900"/></div>
                      <p className="text-[10px] text-yellow-800 font-bold leading-relaxed uppercase tracking-tight">Disclaimer: These notes are strictly for the internal team. They will not be printed on receipts or invoices sent to clients.</p>
                  </div>
              </div>
              <button 
                onClick={handleSaveNarration}
                className="w-full bg-[#1A2232] text-yellow-400 py-5 rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-transform border border-yellow-400/10"
              >
                Update Production Log
              </button>
          </div>
      </Modal>

      {/* Machine Usage Logging */}
      <Modal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Machine Output Calibration">
          <div className="space-y-6">
              <p className="text-sm text-gray-900 font-black uppercase tracking-tight bg-yellow-400/10 p-5 rounded-3xl border border-yellow-400/20 leading-relaxed text-center">
                  Record material consumption for <br /><strong className="text-blue-700 text-lg">INV-#{saleForUsage?.id.substring(0,8).toUpperCase()}</strong>
              </p>
              <div className="overflow-x-auto border-2 border-gray-50 rounded-[2.5rem] shadow-inner bg-gray-50/30 p-2">
                  <table className="w-full text-sm text-left">
                      <thead className="text-gray-400 font-black uppercase text-[10px] tracking-widest">
                          <tr>
                              <th className="px-5 py-4">Billable Item</th>
                              <th className="px-5 py-4">Material Roll</th>
                              <th className="px-5 py-4 text-right">Linear Metres</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {saleForUsage?.items.map((item, index) => {
                              const isPrintItem = item.name.toLowerCase().includes('print') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('dtf') || item.name.toLowerCase().includes('banner');
                              if (!isPrintItem) return null;
                              return (
                                  <tr key={index} className="bg-white">
                                      <td className="px-5 py-4 font-black text-gray-900 text-xs uppercase max-w-[140px] truncate">{item.name}</td>
                                      <td className="px-5 py-4 min-w-[240px]">
                                          <SearchableMaterialSelect 
                                            items={stockItems}
                                            value={usageEntries[index]?.skuId || ''}
                                            onChange={(skuId) => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], skuId } }))}
                                          />
                                      </td>
                                      <td className="px-5 py-4 text-right">
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            value={usageEntries[index]?.meters || ''} 
                                            placeholder="0.00"
                                            onChange={e => setUsageEntries(prev => ({ ...prev, [index]: { ...prev[index], meters: parseFloat(e.target.value) || 0 } }))}
                                            className="block w-20 ml-auto text-right text-xs rounded-xl border-gray-200 shadow-inner focus:ring-2 focus:ring-blue-500 font-black text-blue-700 p-3"
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
                className="w-full bg-[#1A2232] text-yellow-400 py-5 rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 border border-yellow-400/10"
              >
                Sync Stock & Deduct Materials
              </button>
          </div>
      </Modal>

      {/* Confirmation of Transaction */}
      <Modal isOpen={isAddSaleOpen} onClose={() => { setIsAddSaleOpen(false); clearQuote(); }} title="Transaction Authentication">
        <div className="space-y-6">
          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Assign Bill to Client</label>
            <SearchableCustomerSelect 
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                onAddNew={handleQuickAddCustomer}
            />
          </div>

          <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-100 shadow-inner space-y-4">
             <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 text-center">AGGREGATE BILL</h4>
             <div className="max-h-48 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                {quoteForSale.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-xs font-black uppercase">
                    <span className="text-gray-600 flex-1 pr-6 truncate">{item.name} <span className="text-gray-400 font-bold lowercase ml-1">x{item.quantity}</span></span>
                    <strong className="text-gray-900 whitespace-nowrap">{formatUGX(item.price * item.quantity)}</strong>
                </div>
                ))}
             </div>
             
             <div className="pt-4 mt-2 border-t-2 border-dashed border-gray-200 space-y-1">
               <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                   <span>Subtotal</span>
                   <span>{formatUGX(subtotalQuote)}</span>
               </div>
               {quoteDiscount > 0 && (
                   <div className="flex justify-between items-center text-[10px] font-black text-rose-500 uppercase tracking-widest">
                       <span>Discount (Applied)</span>
                       <span>-{formatUGX(quoteDiscount)}</span>
                   </div>
               )}
               <div className="flex justify-between items-baseline pt-2">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Final Payable</span>
                 <span className="text-3xl font-black text-blue-900 tracking-tighter">{formatUGX(totalQuote)}</span>
               </div>
             </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Initial Remittance (UGX)</label>
            <input 
              type="number" 
              value={amountPaid || ''} 
              onChange={e => setAmountPaid(parseInt(e.target.value) || 0)} 
              className="w-full p-5 border-2 border-gray-100 rounded-[2rem] bg-white text-gray-900 font-black text-2xl focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none shadow-xl transition-all"
              placeholder="Enter cash amount..."
            />
          </div>

          <button 
            onClick={handleCreateSale} 
            disabled={!customerId || quoteForSale.length === 0}
            className="w-full bg-[#1A2232] text-yellow-400 py-6 rounded-[2rem] font-black uppercase tracking-[0.25em] text-xs shadow-2xl active:scale-95 disabled:opacity-30 disabled:grayscale transition-all"
          >
            Authenticate & Generate Invoice
          </button>
        </div>
      </Modal>

      {/* Debt Recovery Payment */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setPayingSale(null); }} title="Debt Clearance Protocol">
        <div className="space-y-6">
            {payingSale && (
                <>
                    <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-100 shadow-inner">
                        <div className="flex justify-between items-center mb-5">
                             <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-blue-100">REF: #{payingSale.id.substring(0,8).toUpperCase()}</span>
                             <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${payingSale.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{payingSale.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                 <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Bill</p>
                                 <p className="text-sm font-black text-gray-900">{formatUGX(payingSale.total)}</p>
                             </div>
                             <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                 <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Cleared</p>
                                 <p className="text-sm font-black text-green-600">{formatUGX(payingSale.amountPaid || 0)}</p>
                             </div>
                             <div className="col-span-2 p-5 bg-red-50 rounded-3xl border border-red-100 text-center">
                                 <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-1">Outstanding Liability</p>
                                 <p className="text-3xl font-black text-red-600 tracking-tighter">{formatUGX(payingSale.total - (payingSale.amountPaid || 0))}</p>
                             </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Payment Collected (UGX)</label>
                        <input 
                            type="number" 
                            value={paymentAmount || ''} 
                            onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} 
                            className="w-full p-5 border-2 border-gray-100 rounded-[2rem] bg-white text-gray-900 font-black text-2xl focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none shadow-xl"
                            placeholder="0"
                        />
                    </div>

                    <button 
                        onClick={handleRecordPayment} 
                        className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 disabled:opacity-50 transition-all"
                    >
                        Confirm Debt Clearance
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
        title="Administrative Purge" 
        message="This operation will permanently erase this transactional record from the master log. Proceed with authentication?" 
      />
    </div>
  );
};

export default SalesView;
