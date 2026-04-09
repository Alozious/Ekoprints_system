
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Sale, SystemSettings } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Invoice from './Invoice';
import { PlusIcon, DocumentTextIcon, PrintIcon, EditIcon, TrashIcon, SearchIcon } from './icons';
import { useToast } from '../App';

interface CustomersViewProps {
    customers: Customer[];
    sales: Sale[];
    onAddCustomer: (customerData: Omit<Customer, 'id' | 'createdAt'>) => Promise<void | Customer>;
    onUpdateCustomer: (id: string, customerData: Omit<Customer, 'id' | 'totalSpent' | 'createdAt'>) => Promise<void>;
    onDeleteCustomer: (id: string) => Promise<void>;
    settings: SystemSettings;
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const EditCustomerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    onUpdateCustomer: (id: string, customerData: Omit<Customer, 'id' | 'totalSpent' | 'createdAt'>) => Promise<void>;
}> = ({ isOpen, onClose, customer, onUpdateCustomer }) => {
    const [formData, setFormData] = useState<Omit<Customer, 'id' | 'totalSpent' | 'createdAt'>>({
        name: '', email: '', phone: '', address: ''
    });

    useEffect(() => {
        if (customer) {
            setFormData({
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address
            });
        }
    }, [customer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onUpdateCustomer(customer.id, formData);
        onClose();
    };

    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Customer Profile`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className={darkInput} required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className={darkInput} required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Contact</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={darkInput} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Physical Address</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} className={darkInput} />
                    </div>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-800 transition-all border border-yellow-400/20">Save Profile Updates</button>
                </div>
            </form>
        </Modal>
    );
};

const CustomersView: React.FC<CustomersViewProps> = ({ customers, sales, onAddCustomer, onUpdateCustomer, onDeleteCustomer, settings }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const { addToast } = useToast();

    const [invoiceToView, setInvoiceToView] = useState<Sale | null>(null);

    const [sortOrder, setSortOrder] = useState('date-desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [includeHistory, setIncludeHistory] = useState(false);
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 13;

    const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id' | 'createdAt'>>({
        name: '',
        email: '',
        phone: '',
        address: '',
    });

    const customersWithStats = useMemo(() => {
        return customers.map(customer => {
            const customerSales = sales.filter(sale => sale.customerId === customer.id);
            const totalSpent = customerSales.reduce((total, sale) => total + sale.total, 0);
            const totalPaid = customerSales.reduce((total, sale) => total + (sale.amountPaid || 0), 0);
            const outstandingDebt = totalSpent - totalPaid;
            return { ...customer, totalSpent, outstandingDebt };
        });
    }, [customers, sales]);

    const sortedCustomers = useMemo(() => {
        const filtered = customersWithStats.filter(customer => {
            if (showDebtorsOnly && (customer.outstandingDebt || 0) <= 0) return false;

            if (searchQuery.trim() !== '') {
                const lowerCaseQuery = searchQuery.toLowerCase();
                const isMatch = customer.name.toLowerCase().includes(lowerCaseQuery) ||
                    customer.email.toLowerCase().includes(lowerCaseQuery) ||
                    customer.phone.toLowerCase().includes(lowerCaseQuery) ||
                    customer.address.toLowerCase().includes(lowerCaseQuery);
                if (!isMatch) return false;
            }

            if (filterDateStart) {
                const startDate = new Date(filterDateStart);
                startDate.setHours(0, 0, 0, 0);
                if (new Date(customer.createdAt) < startDate) return false;
            }

            if (filterDateEnd) {
                const endDate = new Date(filterDateEnd);
                endDate.setHours(23, 59, 59, 999);
                if (new Date(customer.createdAt) > endDate) return false;
            }

            return true;
        });

        return [...filtered].sort((a, b) => {
            switch (sortOrder) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'spending-desc':
                    return (b.totalSpent || 0) - (a.totalSpent || 0);
                case 'spending-asc':
                    // Fix: Fixed typo in sorting property name to resolve 'Cannot find name asc' error
                    return (a.totalSpent || 0) - (b.totalSpent || 0);
                case 'debt-desc':
                    return (b.outstandingDebt || 0) - (a.outstandingDebt || 0);
                case 'date-desc':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'date-asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                default:
                    return 0;
            }
        });
    }, [customersWithStats, sortOrder, searchQuery, filterDateStart, filterDateEnd, showDebtorsOnly]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, sortOrder, filterDateStart, filterDateEnd, showDebtorsOnly]);

    const totalPages = Math.ceil(sortedCustomers.length / ITEMS_PER_PAGE);
    const paginatedCustomers = sortedCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Fix: Define customerSales to resolve the "Cannot find name 'customerSales'" error in lines 509 and 522
    const customerSales = useMemo(() => {
        if (!selectedCustomer) return [];
        return sales.filter(sale => sale.customerId === selectedCustomer.id);
    }, [selectedCustomer, sales]);

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        await onAddCustomer(newCustomer);
        setNewCustomer({ name: '', email: '', phone: '', address: '' });
        setIsAddModalOpen(false);
    };

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
        setSelectedSaleIds([]);
        setIsDetailsModalOpen(true);
    };

    const toggleSaleSelection = (saleId: string) => {
        setSelectedSaleIds(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const toggleAllSales = () => {
        if (selectedSaleIds.length === customerSales.length) {
            setSelectedSaleIds([]);
        } else {
            setSelectedSaleIds(customerSales.map(s => s.id));
        }
    };

    const handleGenerateCustomerStatement = () => {
        if (!selectedCustomer || selectedSaleIds.length === 0) {
            addToast("Please select at least one invoice.", "info");
            return;
        }

        const selectedSales = customerSales.filter(s => selectedSaleIds.includes(s.id));
        const totalInvoiced = selectedSales.reduce((sum, s) => sum + s.total, 0);
        const totalPaid = selectedSales.reduce((sum, s) => sum + (s.amountPaid || 0), 0);

        const html = `
      <html>
      <head>
        <title>Customer Statement - ${selectedCustomer.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a2232; padding: 40px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 4px solid #1a2232; padding-bottom: 20px; margin-bottom: 30px; white-space: pre-wrap; }
          .logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
          .customer-info { margin-bottom: 40px; background: #f8fafc; padding: 25px; border-radius: 15px; border: 1px solid #e2e8f0; }
          .invoice-card { margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 15px; overflow: hidden; page-break-inside: avoid; }
          .invoice-header { background: #1a2232; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
          .item-table { width: 100%; border-collapse: collapse; }
          .item-table th { background: #f1f5f9; text-align: left; padding: 12px 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
          .item-table td { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .payment-history { background: #fdfdfd; padding: 20px; border-top: 2px dashed #e2e8f0; }
          .summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
          .summary-card { background: #f8fafc; padding: 20px; border-radius: 15px; text-align: center; border: 1px solid #e2e8f0; }
          .summary-card h4 { margin: 0 0 5px 0; font-size: 10px; text-transform: uppercase; color: #64748b; }
          .summary-card p { margin: 0; font-size: 18px; font-weight: 800; }
          .text-right { text-align: right; }
          .highlight { font-weight: 800; color: #1a2232; }
          .payment-log-row { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding: 4px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><div class="logo">${settings.statementHeader}</div><div>Detailed Customer Statement</div></div>
          <div style="text-align:right">
            <div style="font-weight:800">Generated On</div>
            <div>${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="customer-info">
          <div style="display:grid; grid-template-cols: 1fr 1fr; gap: 20px;">
            <div>
              <div style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase;">Customer Details</div>
              <div style="font-size:18px; font-weight:900; margin:5px 0;">${selectedCustomer.name}</div>
              <div style="font-size:12px;">${selectedCustomer.phone} | ${selectedCustomer.email}</div>
              <div style="font-size:12px; color:#64748b; margin-top:5px;">${selectedCustomer.address}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase;">Account Snapshot</div>
              <div style="margin-top:10px;">
                <span style="font-size:12px; color:#64748b;">Total Selection Hub:</span>
                <span style="font-size:24px; font-weight:900; display:block;">${formatUGX(totalInvoiced)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><h4>Selected Invoices</h4><p>${selectedSales.length}</p></div>
          <div class="summary-card"><h4>Total Amount</h4><p>${formatUGX(totalInvoiced)}</p></div>
          <div class="summary-card"><h4>Total Paid</h4><p style="color:#10b981">${formatUGX(totalPaid)}</p></div>
          <div class="summary-card"><h4>Total Balance</h4><p style="color:#ef4444">${formatUGX(totalInvoiced - totalPaid)}</p></div>
        </div>

        ${selectedSales.map(sale => `
          <div class="invoice-card">
            <div class="invoice-header">
              <div style="font-weight:900;">INVOICE #${sale.id.substring(0, 8).toUpperCase()}</div>
              <div style="font-size:12px; opacity:0.8;">Date: ${new Date(sale.date).toLocaleDateString()}</div>
            </div>
            <table class="item-table">
              <thead>
                <tr>
                  <th>Product/Service Description</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Unit Price</th>
                  <th class="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${formatUGX(item.price)}</td>
                    <td class="text-right highlight">${formatUGX(item.quantity * item.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="padding:15px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:30px;">
              <div style="text-align:right">
                <span style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; display:block;">Invoice Total</span>
                <span style="font-weight:900;">${formatUGX(sale.total)}</span>
              </div>
               <div style="text-align:right">
                <span style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; display:block;">Amount Paid</span>
                <span style="font-weight:900; color:#10b981;">${formatUGX(sale.amountPaid || 0)}</span>
              </div>
               <div style="text-align:right">
                <span style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; display:block;">Balance Due</span>
                <span style="font-weight:900; color:#ef4444;">${formatUGX(sale.total - (sale.amountPaid || 0))}</span>
              </div>
            </div>
            ${sale.payments && sale.payments.length > 0 ? `
              <div class="payment-history">
                <div style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center;">
                  <div style="width:15px; height:1px; background:#e2e8f0; margin-right:10px;"></div>
                  Payment Log Details
                  <div style="width:15px; height:1px; background:#e2e8f0; margin-left:10px;"></div>
                </div>
                ${sale.payments.map(p => `
                  <div class="payment-log-row">
                    <span>${new Date(p.date).toLocaleString()}</span>
                    <span>Received By: ${p.recordedBy}</span>
                    <span style="font-weight:800; color:#10b981;">+ ${formatUGX(p.amount)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
        
        <div style="margin-top:50px; text-align:center; font-size:12px; color:#64748b; white-space: pre-wrap;">
          ${settings.statementFooter}
        </div>
      </body>
      </html>
    `;

        const win = window.open('', '_blank', 'width=1000,height=800');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
    };

    const handleOpenEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setEditingCustomer(null);
        setIsEditModalOpen(false);
    };

    const handleDeleteClick = (customer: Customer) => {
        setCustomerToDelete(customer);
        setIsConfirmModalOpen(true);
    };

    const confirmDelete = () => {
        if (customerToDelete) {
            onDeleteCustomer(customerToDelete.id);
            setCustomerToDelete(null);
        }
    };

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        let rows: string[][] = [];

        if (includeHistory) {
            rows.push(["CustomerID", "CustomerName", "CustomerEmail", "CustomerPhone", "CustomerAddress", "RegisteredOn", "SaleID", "SaleDate", "SaleTotal", "AmountPaid", "Debt"]);
            sales.forEach(sale => {
                const customer = customersWithStats.find(c => c.id === sale.customerId);
                if (customer) {
                    const paid = sale.amountPaid || 0;
                    rows.push([
                        customer.id,
                        `"${customer.name}"`,
                        customer.email,
                        customer.phone,
                        `"${customer.address}"`,
                        new Date(customer.createdAt).toLocaleString(),
                        sale.id,
                        new Date(sale.date).toLocaleDateString(),
                        String(sale.total),
                        String(paid),
                        String(sale.total - paid)
                    ]);
                }
            });
        } else {
            rows.push(["CustomerID", "Name", "Email", "Phone", "Address", "RegisteredOn", "TotalSpent", "OutstandingDebt"]);
            sortedCustomers.forEach(customer => {
                rows.push([
                    customer.id,
                    `"${customer.name}"`,
                    customer.email,
                    customer.phone,
                    `"${customer.address}"`,
                    new Date(customer.createdAt).toLocaleString(),
                    String(customer.totalSpent || 0),
                    String(customer.outstandingDebt || 0)
                ]);
            });
        }

        csvContent += rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `eko_prints_customers_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("CSV export started.", "success");
    };

    const handleExportPDF = () => {
        let reportTitle = "Customer Report";
        let reportHtml = `
        <div style="font-family: Arial, sans-serif; margin: 20px;">
            <h1 style="text-align: center; color: #333;">${reportTitle}</h1>
            <p style="text-align: center; color: #666;">Generated on: ${new Date().toLocaleDateString()}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Contact</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total Spent</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Debt</th>
                    </tr>
                </thead>
                <tbody>
    `;

        sortedCustomers.forEach(customer => {
            reportHtml += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; border: 1px solid #ddd;">${customer.name}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${customer.email}<br/>${customer.phone}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatUGX(customer.totalSpent || 0)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: ${(customer.outstandingDebt || 0) > 0 ? 'red' : 'black'};">${formatUGX(customer.outstandingDebt || 0)}</td>
            </tr>
        `;
        });

        reportHtml += `
                </tbody>
            </table>
        </div>
    `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Customer Report</title></head><body>');
            printWindow.document.write(reportHtml);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    };

    const filterInputClass = "h-[34px] rounded-xl border-none bg-[#374151] px-3 text-[10px] font-bold text-white focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-400";

    return (
        <div className="space-y-4">
            {/* Merged header bar */}
            <div className="bg-white px-4 py-3 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest whitespace-nowrap mr-1">Customer Management</span>
                <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

                {/* Search */}
                <div className="relative flex-1 min-w-[140px] max-w-[220px]">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" placeholder="Search customers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="h-[34px] w-full rounded-xl border-none bg-[#374151] pl-8 pr-3 text-[10px] font-bold text-white focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-400" />
                </div>

                {/* Sort */}
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={filterInputClass}>
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="spending-desc">Top Spenders</option>
                    <option value="spending-asc">Low Spenders</option>
                    <option value="debt-desc">Highest Debt</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                </select>

                {/* Date range */}
                <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className={filterInputClass} />
                <span className="text-[10px] font-black text-gray-300">—</span>
                <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className={filterInputClass} />

                {/* Debtors toggle */}
                <label className="flex items-center cursor-pointer gap-1.5 ml-1">
                    <div className="relative">
                        <input type="checkbox" checked={showDebtorsOnly} onChange={e => setShowDebtorsOnly(e.target.checked)} className="sr-only" />
                        <div className={`w-8 h-4 rounded-full shadow-inner transition-colors ${showDebtorsOnly ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                        <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showDebtorsOnly ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest whitespace-nowrap">Debtors Only</span>
                </label>

                {/* History toggle */}
                <label className="flex items-center cursor-pointer gap-1.5 ml-1">
                    <div className="relative">
                        <input type="checkbox" checked={includeHistory} onChange={e => setIncludeHistory(e.target.checked)} className="sr-only" />
                        <div className={`w-8 h-4 rounded-full shadow-inner transition-colors ${includeHistory ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
                        <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${includeHistory ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">w/ History</span>
                </label>

                <div className="ml-auto flex items-center gap-2">
                    <button onClick={handleExportCSV} className="flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
                        <DocumentTextIcon className="w-3.5 h-3.5 mr-1" /> CSV
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100">
                        <PrintIcon className="w-3.5 h-3.5 mr-1" /> PDF
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-400 text-[#1A2232] px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500 shadow-md active:scale-95 transition-all whitespace-nowrap">
                        <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add Customer
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100">
                <table className="w-full table-fixed text-left">
                    <thead className="text-[9px] text-gray-400 uppercase bg-gray-50 font-black tracking-widest">
                        <tr>
                            <th className="px-4 py-3 w-[20%]">Name</th>
                            <th className="px-4 py-3 w-[18%]">Contact</th>
                            <th className="px-4 py-3 w-[18%]">Address</th>
                            <th className="px-4 py-3 w-[12%]">Registered</th>
                            <th className="px-4 py-3 w-[14%] text-right">Total Spent</th>
                            <th className="px-4 py-3 w-[10%] text-right">Debt</th>
                            <th className="px-4 py-3 w-[8%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginatedCustomers.map((customer) => (
                            <tr key={customer.id} className="bg-white hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2 text-[10px] font-black text-gray-900 uppercase truncate">{customer.name}</td>
                                <td className="px-4 py-2">
                                    <div className="text-[10px] text-blue-600 font-bold truncate">{customer.email}</div>
                                    <div className="text-[9px] text-gray-400 font-black uppercase truncate">{customer.phone}</div>
                                </td>
                                <td className="px-4 py-2 text-[10px] font-bold text-gray-500 truncate">{customer.address}</td>
                                <td className="px-4 py-2 text-[10px] text-gray-400 font-medium">{new Date(customer.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-2 text-right text-[10px] font-black text-gray-900">{formatUGX(customer.totalSpent || 0)}</td>
                                <td className={`px-4 py-2 text-right text-[10px] font-black ${(customer.outstandingDebt || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {(customer.outstandingDebt || 0) > 0 ? formatUGX(customer.outstandingDebt || 0) : '✓'}
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleViewDetails(customer)} title="Details"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-all active:scale-90">
                                            <DocumentTextIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleOpenEditModal(customer)} title="Edit"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all active:scale-90">
                                            <EditIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteClick(customer)} title="Delete"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {sortedCustomers.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-[10px]">No customers found</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, sortedCustomers.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedCustomers.length)} of {sortedCustomers.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-all">‹</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                .map((p, idx, arr) => (
                                    <React.Fragment key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-300 text-[10px]">…</span>}
                                        <button onClick={() => setCurrentPage(p)}
                                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${p === currentPage ? 'bg-[#1A2232] text-yellow-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                            {p}
                                        </button>
                                    </React.Fragment>
                                ))}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-all">›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Customer Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Client">
                <form onSubmit={handleAddCustomer} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                            <input type="text" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className="block w-full rounded-2xl bg-gray-800 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500" required placeholder="e.g. John Doe" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} className="block w-full rounded-2xl bg-gray-800 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500" required placeholder="name@company.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Contact</label>
                            <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="block w-full rounded-2xl bg-gray-800 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500" placeholder="+256..." />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Physical/Office Address</label>
                            <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} className="block w-full rounded-2xl bg-gray-800 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500" placeholder="Street, Building, City" />
                        </div>
                    </div>
                    <div className="pt-4">
                        <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all hover:bg-blue-700 border border-blue-500/20">Enrol Customer to Registry</button>
                    </div>
                </form>
            </Modal>

            {/* Edit Customer Modal */}
            {editingCustomer && (
                <EditCustomerModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    customer={editingCustomer}
                    onUpdateCustomer={onUpdateCustomer}
                />
            )}

            {/* Customer Details Modal */}
            {selectedCustomer && (
                <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Customer Master File`}>
                    <div className="space-y-8">
                        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100 shadow-inner">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-5 ml-1">Contact Intelligence</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                <div><p className="text-[8px] font-black text-gray-400 uppercase">Registered Name</p><p className="text-sm font-black text-gray-900">{selectedCustomer.name}</p></div>
                                <div><p className="text-[8px] font-black text-gray-400 uppercase">Account Email</p><p className="text-sm font-black text-blue-600">{selectedCustomer.email}</p></div>
                                <div><p className="text-[8px] font-black text-gray-400 uppercase">Primary Phone</p><p className="text-sm font-black text-gray-900">{selectedCustomer.phone || 'N/A'}</p></div>
                                <div><p className="text-[8px] font-black text-gray-400 uppercase">Enrolment Date</p><p className="text-sm font-black text-gray-900">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</p></div>
                                <div className="sm:col-span-2"><p className="text-[8px] font-black text-gray-400 uppercase">Known Location</p><p className="text-sm font-black text-gray-900">{selectedCustomer.address || 'No Address Recorded'}</p></div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between items-center">
                                <div><p className="text-[8px] font-black text-gray-400 uppercase">Outstanding Liability</p><p className={`text-2xl font-black ${(selectedCustomer.outstandingDebt || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatUGX(selectedCustomer.outstandingDebt || 0)}</p></div>
                                <div className="text-right"><p className="text-[8px] font-black text-gray-400 uppercase">Aggregate Lifecycle Spend</p><p className="text-xl font-black text-gray-900">{formatUGX(selectedCustomer.totalSpent || 0)}</p></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4 ml-1">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transactional Archive</h3>
                                {selectedSaleIds.length > 0 && (
                                    <button
                                        onClick={handleGenerateCustomerStatement}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center"
                                    >
                                        <PrintIcon className="w-3.5 h-3.5 mr-2" /> Generate Statement ({selectedSaleIds.length})
                                    </button>
                                )}
                            </div>
                            {customerSales.length > 0 ? (
                                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-[9px] uppercase font-black text-gray-400 tracking-tighter">
                                            <tr>
                                                <th className="px-5 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        checked={selectedSaleIds.length === customerSales.length && customerSales.length > 0}
                                                        onChange={toggleAllSales}
                                                    />
                                                </th>
                                                <th className="px-5 py-3">REF</th>
                                                <th className="px-5 py-3">DATE</th>
                                                <th className="px-5 py-3 text-right">VALUE</th>
                                                <th className="px-5 py-3 text-right">STATUS</th>
                                                <th className="px-5 py-3 text-center">FILE</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {customerSales.map(sale => {
                                                const paid = sale.amountPaid || 0;
                                                const balance = sale.total - paid;
                                                const isSelected = selectedSaleIds.includes(sale.id);
                                                return (
                                                    <tr key={sale.id} className={`bg-white hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="px-5 py-3">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                checked={isSelected}
                                                                onChange={() => toggleSaleSelection(sale.id)}
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3 font-mono font-bold text-gray-900 text-xs">#{sale.id.substring(0, 8).toUpperCase()}</td>
                                                        <td className="px-5 py-3 text-[10px] text-gray-500 font-bold">{new Date(sale.date).toLocaleDateString()}</td>
                                                        <td className="px-5 py-3 text-right font-black text-gray-900 text-xs">{formatUGX(sale.total)}</td>
                                                        <td className="px-5 py-3 text-right">
                                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {balance > 0 ? 'Due' : 'Paid'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <button onClick={() => setInvoiceToView(sale)} className="text-blue-600 hover:text-blue-800 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"><DocumentTextIcon className="w-4 h-4" /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                    <p className="text-xs text-gray-300 font-black uppercase tracking-[0.2em]">Void Transactional History</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {invoiceToView && selectedCustomer && (
                <Invoice
                    isOpen={!!invoiceToView}
                    onClose={() => setInvoiceToView(null)}
                    sale={{ ...invoiceToView, customer: selectedCustomer }}
                    settings={settings}
                />
            )}

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmDelete}
                title="Administrative Sanction"
                message={`This operation will permanently erase "${customerToDelete?.name}" and all historical context from the master registry. Authorize purge?`}
            />
        </div>
    );
};

export default CustomersView;
