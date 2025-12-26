

import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Sale } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Invoice from './Invoice';
import { PlusIcon, DocumentTextIcon, PrintIcon, EditIcon, TrashIcon } from './icons';
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
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Customer: ${customer.name}`}>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Save Changes</button>
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
  
  // State for Invoice Modal
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
        // Use fallback for outstandingDebt in filter logic
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
  
  const customerSales = selectedCustomer ? sales.filter(sale => sale.customerId === selectedCustomer.id) : [];

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
        if (includeHistory) {
            const customerSales = sales.filter(s => s.customerId === customer.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (customerSales.length > 0) {
                reportHtml += `
                    <tr>
                        <td colspan="4" style="padding: 10px; background-color: #fafafa;">
                            <h4 style="margin: 0 0 5px 10px; font-size: 0.9em; color: #555;">Purchase History:</h4>
                            <table style="width: 95%; margin-left: auto; margin-right: auto; border-collapse: collapse;">
                                <thead>
                                    <tr style="font-size: 0.8em; background-color: #e9e9e9;">
                                        <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Sale ID</th>
                                        <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Date</th>
                                        <th style="padding: 5px; border: 1px solid #ccc; text-align: right;">Total</th>
                                        <th style="padding: 5px; border: 1px solid #ccc; text-align: right;">Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${customerSales.map(sale => `
                                        <tr style="font-size: 0.8em;">
                                            <td style="padding: 5px; border: 1px solid #ccc;">${sale.id.substring(0, 8)}...</td>
                                            <td style="padding: 5px; border: 1px solid #ccc;">${new Date(sale.date).toLocaleDateString()}</td>
                                            <td style="padding: 5px; border: 1px solid #ccc; text-align: right;">${formatUGX(sale.total)}</td>
                                            <td style="padding: 5px; border: 1px solid #ccc; text-align: right;">${formatUGX(sale.amountPaid || 0)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                `;
            }
        }
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
    } else {
        addToast("Could not open print window. Please disable popup blockers.", "error");
    }
  };


  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Customer Management</h2>
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-yellow-600 transition-colors font-semibold">
                <PlusIcon className="w-5 h-5 mr-2"/> Add Customer
            </button>
      </div>

       <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-start gap-4">
            <div className="flex items-center gap-2">
                <label htmlFor="sort-customers" className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                    id="sort-customers"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
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
            <div className="flex-grow min-w-[250px] max-w-sm">
                <input
                    type="text"
                    placeholder="Search by name, phone, or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
            </div>
             <div className="flex items-center gap-4">
                <div className="flex items-center">
                    <input
                        id="show-debtors"
                        type="checkbox"
                        checked={showDebtorsOnly}
                        onChange={e => setShowDebtorsOnly(e.target.checked)}
                        className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label htmlFor="show-debtors" className="ml-2 block text-sm font-bold text-red-700">
                        Show Debtors Only
                    </label>
                </div>
            </div>
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Date From:</label>
                <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
            </div>
            <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center">
                    <input
                        id="include-history"
                        type="checkbox"
                        checked={includeHistory}
                        onChange={e => setIncludeHistory(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="include-history" className="ml-2 block text-sm text-gray-900">
                        Include purchase history
                    </label>
                </div>
                <button onClick={handleExportCSV} className="flex items-center bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-200 transition-colors">
                    <DocumentTextIcon className="w-5 h-5 mr-2" /> CSV
                </button>
                <button onClick={handleExportPDF} className="flex items-center bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">
                    <PrintIcon className="w-5 h-5 mr-2" /> PDF
                </button>
            </div>
        </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3">Name</th>
                    <th scope="col" className="px-6 py-3">Contact</th>
                    <th scope="col" className="px-6 py-3">Address</th>
                    <th scope="col" className="px-6 py-3">Registered On</th>
                    <th scope="col" className="px-6 py-3 text-right">Total Spent</th>
                    <th scope="col" className="px-6 py-3 text-right">Debt</th>
                    <th scope="col" className="px-6 py-3 text-center">Actions</th>
                </tr>
                </thead>
                <tbody>
                {sortedCustomers.map((customer, index) => (
                    <tr key={customer.id} className="bg-white border-b hover:bg-gray-50 slide-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{customer.name}</th>
                        <td className="px-6 py-4">
                            <div>{customer.email}</div>
                            <div className="text-xs text-gray-500">{customer.phone}</div>
                        </td>
                        <td className="px-6 py-4">{customer.address}</td>
                        <td className="px-6 py-4">{new Date(customer.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium">{formatUGX(customer.totalSpent || 0)}</td>
                        <td className={`px-6 py-4 text-right font-bold ${(customer.outstandingDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(customer.outstandingDebt || 0) > 0 ? formatUGX(customer.outstandingDebt || 0) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center items-center space-x-2">
                                <button onClick={() => handleViewDetails(customer)} className="text-blue-600 hover:underline text-sm">Details</button>
                                <button onClick={() => handleOpenEditModal(customer)} className="text-indigo-500 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-100" title="Edit Customer"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleDeleteClick(customer)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100" title="Delete Customer"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
      </div>
      
      {/* Add Customer Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Customer">
        <form onSubmit={handleAddCustomer}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input type="text" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
              </div>
               <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
              </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors">Add Customer</button>
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
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Customer Details: ${selectedCustomer.name}`}>
            <div>
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
                    <p className="mt-1 text-sm text-gray-600"><strong>Email:</strong> {selectedCustomer.email}</p>
                    <p className="mt-1 text-sm text-gray-600"><strong>Phone:</strong> {selectedCustomer.phone}</p>
                    <p className="mt-1 text-sm text-gray-600"><strong>Address:</strong> {selectedCustomer.address}</p>
                    <p className="mt-1 text-sm text-gray-600"><strong>Registered On:</strong> {new Date(selectedCustomer.createdAt).toLocaleString()}</p>
                    {/* Fixed missing outstandingDebt property access with fallback */}
                    <p className="mt-1 text-sm text-gray-600"><strong>Outstanding Debt:</strong> <span className={(selectedCustomer.outstandingDebt || 0) > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>{formatUGX(selectedCustomer.outstandingDebt || 0)}</span></p>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Purchase History</h3>
                    {customerSales.length > 0 ? (
                        <div className="mt-2 border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {customerSales.map(sale => {
                                    const paid = sale.amountPaid || 0;
                                    const balance = sale.total - paid;
                                    return (
                                        <tr key={sale.id}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{sale.id.substring(0,8)}...</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(sale.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                <div className="max-w-[150px] truncate" title={sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}>
                                                    {sale.items.map(i => i.name).join(', ')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{formatUGX(sale.total)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{formatUGX(paid)}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${balance > 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>{balance > 0 ? formatUGX(balance) : '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <button 
                                                    onClick={() => setInvoiceToView(sale)}
                                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                                                >
                                                    View Invoice
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-gray-500">No purchase history found for this customer.</p>
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
        title="Confirm Customer Deletion"
        message={`Are you sure you want to delete "${customerToDelete?.name}"? This action cannot be undone.`}
       />
    </div>
  );
};

export default CustomersView;