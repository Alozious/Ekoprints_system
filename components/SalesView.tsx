
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sale, InventoryItem, Customer, User, SaleItem, StockItem, PricingTier, Payment, SystemSettings } from '../types';
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
    settings: SystemSettings;
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
    onAddSale, onDeleteSale, onUpdateSale, onAddCustomer, stockItems, onStockOut, settings
}) => {
    const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
    const [isNarrationModalOpen, setIsNarrationModalOpen] = useState(false);
    const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);

    const [selectedSale, setSelectedSale] = useState<(Sale & { customer: Customer }) | null>(null);
    const [payingSale, setPayingSale] = useState<Sale | null>(null);
    const [saleForUsage, setSaleForUsage] = useState<Sale | null>(null);
    const [saleForNarration, setSaleForNarration] = useState<Sale | null>(null);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

    const [editedItems, setEditedItems] = useState<SaleItem[]>([]);
    const [editedDiscount, setEditedDiscount] = useState(0);
    const [editedNarration, setEditedNarration] = useState('');

    const [usageEntries, setUsageEntries] = useState<{ [key: string]: { skuId: string, meters: number } }>({});
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
    const [dateMode, setDateMode] = useState<'any' | 'specific' | 'range'>('any');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 13;

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
        const initialEntries: { [key: string]: { skuId: string, meters: number } } = {};

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
                    `INV-${saleForUsage.id.substring(0, 8)}`,
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
            addToast(`Machine consumption logged for #${saleForUsage.id.substring(0, 8)}`, "success");
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
            start.setHours(0, 0, 0, 0);
            list = list.filter(s => new Date(s.date) >= start);
        }
        if (filterDateEnd) {
            const end = new Date(filterDateEnd);
            end.setHours(23, 59, 59, 999);
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

    // Reset to first page whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, filterUser, filterDateStart, filterDateEnd, searchQuery]);

    const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
    const paginatedSales = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredSales.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredSales, currentPage]);

    return (
        <div className="space-y-4">
            {/* Single combined header + filters row */}
            <div className="bg-white px-4 py-3 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">

                    {/* Title */}
                    <h2 className="text-xs font-black text-gray-900 uppercase tracking-tight shrink-0 whitespace-nowrap mr-1">
                        Sales Operations
                    </h2>
                    <div className="w-px h-5 bg-gray-200 shrink-0 hidden lg:block" />

                    {/* Search */}
                    <div className="relative flex-[2] min-w-[130px]">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Invoice # or Customer..."
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                        />
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>

                    {/* Status */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Paid">Fully Paid</option>
                        <option value="Partially Paid">Partial</option>
                        <option value="Unpaid">Arrears</option>
                    </select>

                    {/* Sales Rep (admin only) */}
                    {currentUser.role === 'admin' && (
                        <select
                            value={filterUser}
                            onChange={e => setFilterUser(e.target.value)}
                            className="flex-1 min-w-[100px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                        >
                            <option value="All">All Staff</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                    )}

                    {/* Date mode */}
                    <select
                        value={dateMode}
                        onChange={e => {
                            const mode = e.target.value as any;
                            setDateMode(mode);
                            if (mode === 'any') { setFilterDateStart(''); setFilterDateEnd(''); }
                            else if (mode === 'specific' && filterDateStart) setFilterDateEnd(filterDateStart);
                        }}
                        className="min-w-[100px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    >
                        <option value="any">Any Date</option>
                        <option value="specific">Specific Date</option>
                        <option value="range">Date Range</option>
                    </select>

                    {/* Date inputs or placeholder — all on same row, same height */}
                    {dateMode === 'specific' && (
                        <input type="date" value={filterDateStart} onChange={e => { setFilterDateStart(e.target.value); setFilterDateEnd(e.target.value); }}
                            className="flex-1 min-w-[120px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all" />
                    )}
                    {dateMode === 'range' && (
                        <>
                            <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                                className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all" />
                            <span className="text-gray-300 font-black text-xs shrink-0">–</span>
                            <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                                className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-black font-bold focus:ring-2 focus:ring-yellow-400 outline-none transition-all" />
                        </>
                    )}
                    {dateMode === 'any' && (
                        <div className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-[9px] font-black uppercase tracking-widest">
                            No Filter Active
                        </div>
                    )}

                    {/* New Transaction button */}
                    <button
                        onClick={() => setIsAddSaleOpen(true)}
                        className="shrink-0 bg-yellow-500 text-[#1A2232] px-5 py-2 rounded-xl font-black flex items-center shadow-md hover:bg-yellow-600 transition-all active:scale-95 uppercase tracking-widest text-[10px] border border-yellow-600/10 whitespace-nowrap"
                    >
                        <PlusIcon className="w-4 h-4 mr-1.5" /> New Transaction
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-black text-[9px] tracking-[0.12em]">
                        <tr>
                            <th className="px-4 py-3 w-[10%]">Ref</th>
                            <th className="px-4 py-3 w-[22%]">Client</th>
                            <th className="px-4 py-3 w-[14%]">Date</th>
                            <th className="px-4 py-3 w-[14%] text-right">Value</th>
                            <th className="px-4 py-3 w-[14%] text-right">Balance</th>
                            <th className="px-4 py-3 w-[10%] text-center">Status</th>
                            <th className="px-4 py-3 w-[16%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginatedSales.map(sale => {
                            const balance = sale.total - (sale.amountPaid || 0);
                            const customer = customers.find(c => c.id === sale.customerId);
                            return (
                                <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-4 py-2 font-mono font-bold text-blue-600 text-[10px] truncate">
                                        #{sale.id.substring(0, 7).toUpperCase()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <p className="font-bold text-gray-900 text-[11px] uppercase truncate">{customer?.name || 'Guest'}</p>
                                        <p className="text-[9px] text-gray-400 font-medium truncate">
                                            {customer?.phone || '—'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 font-medium text-[10px]">
                                        {new Date(sale.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })}
                                        <span className="block text-[9px] text-gray-400">
                                            {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-gray-900 text-[10px]">
                                        {formatUGX(sale.total)}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {balance > 0 ? (
                                            <span className="font-bold text-rose-600 text-[10px]">{formatUGX(balance)}</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold text-[9px] uppercase">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                Settled
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tight ${
                                            sale.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                            sale.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                            {sale.status === 'Partially Paid' ? 'Partial' : sale.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center justify-start gap-1">
                                            <button onClick={() => handleViewInvoice(sale)} title="View Invoice"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-all active:scale-90">
                                                <DocumentTextIcon className="w-3.5 h-3.5" />
                                            </button>
                                            {currentUser.role === 'admin' ? (
                                                <button onClick={() => handleOpenEditInvoice(sale)} title="Edit Invoice"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all active:scale-90">
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenNarration(sale)} title="Notes"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100 transition-all active:scale-90">
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {sale.status !== 'Paid' && (
                                                <button onClick={() => handleOpenPayment(sale)} title="Receive Payment"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-all active:scale-90">
                                                    <BanknotesIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {isLoggable(sale) && (
                                                <button onClick={() => handleOpenUsageModal(sale)} title="Log Usage"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 animate-blink active:scale-90">
                                                    <BeakerIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {currentUser.role === 'admin' && (
                                                <button onClick={() => { setSaleToDelete(sale); setIsConfirmDeleteOpen(true); }} title="Delete"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredSales.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-8 py-16 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-[10px]">
                                    No records found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {filteredSales.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-50">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            {filteredSales.length === 0 ? 'No records' : `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} of ${filteredSales.length} records`}
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-black text-sm"
                                >
                                    ‹
                                </button>
                                {(() => {
                                    const pages: number[] = [];
                                    const maxVisible = 5;
                                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                    let end = Math.min(totalPages, start + maxVisible - 1);
                                    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    return pages.map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === page ? 'bg-[#1A2232] text-yellow-400 shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                        >
                                            {page}
                                        </button>
                                    ));
                                })()}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-black text-sm"
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Admin Edit Invoice Modal - Powerful Inline Editor */}
            <Modal isOpen={isEditInvoiceModalOpen} onClose={() => setIsEditInvoiceModalOpen(false)} title="Administrative Invoice Editor">
                <div className="space-y-6">
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3">
                        <div className="p-2 bg-orange-400 rounded-xl text-white shadow-sm"><EditIcon className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest leading-none mb-1">Administrative Overide</p>
                            <p className="text-xs font-bold text-orange-600">Modifying Invoice: <strong className="text-gray-900">#{saleToEdit?.id.substring(0, 8).toUpperCase()}</strong></p>
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
                                                <button onClick={() => handleRemoveItemInEdit(idx)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
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
                            <div className="p-1.5 bg-yellow-400 rounded-lg shrink-0 mt-0.5"><BeakerIcon className="w-3.5 h-3.5 text-gray-900" /></div>
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
                        Record material consumption for <br /><strong className="text-blue-700 text-lg">INV-#{saleForUsage?.id.substring(0, 8).toUpperCase()}</strong>
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
                                    <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-blue-100">REF: #{payingSale.id.substring(0, 8).toUpperCase()}</span>
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

            {selectedSale && <Invoice isOpen={isInvoiceOpen} onClose={() => setIsInvoiceOpen(false)} sale={selectedSale} settings={settings} />}

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
