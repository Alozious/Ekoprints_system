
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Sale } from '../types';
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

const CustomersView: React.FC<CustomersViewProps> = ({ customers, sales, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
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
    setIsDetailsModalOpen(true);
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

  const darkFilterInput = "block w-full rounded-xl border-none bg-[#374151] p-2.5 text-xs font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-400";
  const darkSearchInput = "block w-full rounded-xl border-none bg-[#374151] pl-10 pr-4 py-2.5 text-xs font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-400";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest";

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Customer Management</h2>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-yellow-500 text-[#1A2232] px-8 py-3 rounded-2xl font-black flex items-center shadow-xl hover:bg-yellow-600 transition-all active:scale-95 uppercase tracking-widest text-xs border border-yellow-600/10">
                <PlusIcon className="w-5 h-5 mr-3"/> Add Customer
            </button>
      </div>

       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-50 space-y-4">
            <div className="flex flex-wrap items-end gap-5">
                <div className="flex flex-col gap-1.5">
                    <label className={labelStyle}>Sort by:</label>
                    <select
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value)}
                        className={darkFilterInput}
                    >
                        <option value="date-desc">Date (Newest First)</option>
                        <option value="date-asc">Date (Oldest First)</option>
                        <option value="spending-desc">Highest Spending</option>
                        <option value="spending-asc">Lowest Spending</option>
                        <option value="debt-desc">Highest Debt</option>
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                    </select>
                </div>

                <div className="flex-grow max-w-sm flex flex-col gap-1.5">
                    <label className={labelStyle}>Global Search:</label>
                    <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={darkSearchInput}
                        />
                    </div>
                </div>

                <div className="flex items-center h-[38px]">
                    <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={showDebtorsOnly}
                                onChange={e => setShowDebtorsOnly(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`w-10 h-5 bg-gray-200 rounded-full shadow-inner transition-colors ${showDebtorsOnly ? 'bg-red-500' : ''}`}></div>
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showDebtorsOnly ? 'translate-x-5' : ''}`}></div>
                        </div>
                        <span className="ml-3 text-[11px] font-black text-red-600 uppercase tracking-widest group-hover:text-red-700">Show Debtors Only</span>
                    </label>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className={labelStyle}>Date From:</label>
                    <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className={darkFilterInput} />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className={labelStyle}>To:</label>
                    <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className={darkFilterInput} />
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={includeHistory}
                            onChange={e => setIncludeHistory(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-10 h-5 bg-gray-200 rounded-full shadow-inner transition-colors ${includeHistory ? 'bg-blue-500' : ''}`}></div>
                        <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeHistory ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Include purchase history</span>
                </label>

                <div className="flex items-center gap-3">
                    <button onClick={handleExportCSV} className="flex items-center bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
                        <DocumentTextIcon className="w-4 h-4 mr-2" /> CSV
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center bg-rose-50 text-rose-700 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100">
                        <PrintIcon className="w-4 h-4 mr-2" /> PDF
                    </button>
                </div>
            </div>
        </div>

      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-gray-400 uppercase bg-gray-50/50 font-black tracking-widest">
                <tr>
                    <th className="px-8 py-5">Name</th>
                    <th className="px-8 py-5">Contact</th>
                    <th className="px-8 py-5">Address</th>
                    <th className="px-8 py-5">Registered On</th>
                    <th className="px-8 py-5 text-right">Total Spent</th>
                    <th className="px-8 py-5 text-right">Debt</th>
                    <th className="px-8 py-5 text-center">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                {sortedCustomers.map((customer, index) => (
                    <tr key={customer.id} className="bg-white hover:bg-gray-50 transition-colors slide-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                        <td className="px-8 py-4 font-black text-gray-900 uppercase tracking-tight">{customer.name}</td>
                        <td className="px-8 py-4">
                            <div className="text-blue-600 font-bold text-[11px]">{customer.email}</div>
                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{customer.phone}</div>
                        </td>
                        <td className="px-8 py-4 text-[11px] font-black text-gray-500 uppercase">{customer.address}</td>
                        <td className="px-8 py-4 text-[11px] text-gray-400 font-medium">{new Date(customer.createdAt).toLocaleDateString()}</td>
                        <td className="px-8 py-4 text-right font-black text-gray-900">{formatUGX(customer.totalSpent || 0)}</td>
                        <td className={`px-8 py-4 text-right font-black ${(customer.outstandingDebt || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {(customer.outstandingDebt || 0) > 0 ? formatUGX(customer.outstandingDebt || 0) : '-'}
                        </td>
                        <td className="px-8 py-4 text-center">
                            <div className="flex justify-center items-center space-x-3">
                                <button onClick={() => handleViewDetails(customer)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 hover:underline">Details</button>
                                <button onClick={() => handleOpenEditModal(customer)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 hover:scale-110 transition-all" title="Edit Customer"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteClick(customer)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:scale-110 transition-all" title="Delete Customer"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </td>
                    </tr>
                ))}
                {sortedCustomers.length === 0 && (
                    <tr>
                        <td colSpan={7} className="px-8 py-24 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-xs">Zero Client Footprint Detected</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
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
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Transactional Archive</h3>
                    {customerSales.length > 0 ? (
                        <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-[9px] uppercase font-black text-gray-400 tracking-tighter">
                                <tr>
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
                                    return (
                                        <tr key={sale.id} className="bg-white hover:bg-gray-50">
                                            <td className="px-5 py-3 font-mono font-bold text-gray-900 text-xs">#{sale.id.substring(0,8).toUpperCase()}</td>
                                            <td className="px-5 py-3 text-[10px] text-gray-500 font-bold">{new Date(sale.date).toLocaleDateString()}</td>
                                            <td className="px-5 py-3 text-right font-black text-gray-900 text-xs">{formatUGX(sale.total)}</td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {balance > 0 ? 'Due' : 'Paid'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button onClick={() => setInvoiceToView(sale)} className="text-blue-600 hover:text-blue-800 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"><DocumentTextIcon className="w-4 h-4"/></button>
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
                sale={{...invoiceToView, customer: selectedCustomer}} 
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
