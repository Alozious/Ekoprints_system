
import React, { useState, useMemo } from 'react';
import { Expense, User, ExpenseCategory } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { PlusIcon, EditIcon, TrashIcon, DocumentTextIcon, PrintIcon } from './icons';
import { useToast } from '../App';

interface ExpensesViewProps {
  expenses: Expense[];
  currentUser: User;
  users: User[];
  expenseCategories: ExpenseCategory[];
  onAddExpense: (expenseData: Omit<Expense, 'id' | 'userId' | 'userName'>) => Promise<void>;
  onUpdateExpense: (id: string, expenseData: Omit<Expense, 'id' | 'userId' | 'userName'>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onAddExpenseCategory: (name: string) => Promise<any>;
  onUpdateExpenseCategory: (id: string, name: string) => Promise<any>;
  onDeleteExpenseCategory: (id: string) => Promise<any>;
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const CategoryManager: React.FC<Pick<ExpensesViewProps, 'expenseCategories' | 'onAddExpenseCategory' | 'onUpdateExpenseCategory' | 'onDeleteExpenseCategory'>> = 
({ expenseCategories, onAddExpenseCategory, onUpdateExpenseCategory, onDeleteExpenseCategory }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        await onAddExpenseCategory(newCategoryName);
        setNewCategoryName('');
        setIsAddModalOpen(false);
    }
    
    const handleOpenEdit = (category: ExpenseCategory) => {
        setEditingCategory(category);
        setIsEditModalOpen(true);
    }

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            await onUpdateExpenseCategory(editingCategory.id, editingCategory.name);
            setIsEditModalOpen(false);
            setEditingCategory(null);
        }
    }

    const handleDeleteClick = (category: ExpenseCategory) => {
        setCategoryToDelete(category);
        setIsConfirmModalOpen(true);
    };

    const confirmDelete = () => {
        if(categoryToDelete) {
            onDeleteExpenseCategory(categoryToDelete.id);
            setCategoryToDelete(null);
        }
    };

    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
    
    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-2xl mx-auto border border-gray-100">
             <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Expense Categories</h3>
                 <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-400 text-[#1A2232] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-yellow-500 shadow-md active:scale-95 transition-all"><PlusIcon className="w-4 h-4 mr-1"/> New Category</button>
            </div>
            <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left text-gray-500">
                     <thead className="text-[10px] text-gray-400 uppercase bg-gray-50 font-black tracking-widest">
                        <tr>
                             <th className="px-6 py-4">Category Name</th>
                             <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                    <tbody className="divide-y divide-gray-50">
                        {expenseCategories.map(cat => (
                           <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                               <td className="px-6 py-4 font-bold text-gray-900">{cat.name}</td>
                               <td className="px-6 py-4 text-right">
                                   <div className="flex items-center justify-end space-x-3">
                                       <button onClick={() => handleOpenEdit(cat)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><EditIcon className="w-4 h-4" /></button>
                                       <button onClick={() => handleDeleteClick(cat)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><TrashIcon className="w-4 h-4" /></button>
                                   </div>
                               </td>
                           </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Expense Category">
                <form onSubmit={handleAddCategory} className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Label</label>
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className={darkInput} required autoFocus placeholder="e.g. Electricity" />
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-800 transition-all">Add Category</button>
                </form>
            </Modal>

            {editingCategory && <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modify Category">
                <form onSubmit={handleUpdateCategory} className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Label</label>
                    <input type="text" value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} className={darkInput} required autoFocus />
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-800 transition-all">Save Changes</button>
                </form>
            </Modal>}

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmDelete}
                title="Purge Category"
                message={`Permanently delete "${categoryToDelete?.name}"? Ensure it's not currently linked to any historical records.`}
            />
        </div>
    );
};

const ExpensesView: React.FC<ExpensesViewProps> = (props) => {
  const { expenses, currentUser, users, expenseCategories, onAddExpense, onUpdateExpense, onDeleteExpense } = props;
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { addToast } = useToast();

  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'userId' | 'userName'>>({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: 0,
  });

  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddExpense(newExpense);
    setNewExpense({ date: new Date().toISOString().split('T')[0], category: '', description: '', amount: 0 });
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditModalOpen(true);
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const { id, userId, userName, ...updateData } = editingExpense;
    await onUpdateExpense(id, updateData);
    setIsEditModalOpen(false);
    setEditingExpense(null);
  };
  
  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };
  
  const getUsername = (userId: string) => users.find(u => u.id === userId)?.username || 'Unknown User';
  
  const displayedExpenses = useMemo(() => {
    if (currentUser.role === 'admin') {
      return expenses.map(e => ({...e, userName: getUsername(e.userId)}))
        .filter(expense => {
            if (filterUser && expense.userId !== filterUser) return false;
            if (filterCategory && expense.category !== filterCategory) return false;
            if (filterDateStart && new Date(expense.date) < new Date(filterDateStart)) return false;
            if (filterDateEnd && new Date(expense.date) > new Date(filterDateEnd)) return false;
            return true;
        });
    }
    const today = new Date().toDateString();
    return expenses.filter(expense => 
        expense.userId === currentUser.id && new Date(expense.date).toDateString() === today
    );
  }, [expenses, currentUser, users, filterUser, filterCategory, filterDateStart, filterDateEnd]);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Date", "User", "Category", "Description", "Amount (UGX)"];
    csvContent += headers.join(",") + "\n";

    displayedExpenses.forEach(expense => {
        const row = [
            new Date(expense.date).toLocaleDateString(),
            `"${expense.userName}"`,
            `"${expense.category}"`,
            `"${expense.description.replace(/"/g, '""')}"`,
            expense.amount
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eko_prints_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("CSV export started.", "success");
  };

    const handleExportPDF = () => {
        let reportTitle = "Expenses Report";
        let filtersUsed = [
            filterUser ? `User: ${users.find(u=>u.id === filterUser)?.username}` : '',
            filterCategory ? `Category: ${filterCategory}` : '',
            filterDateStart ? `From: ${new Date(filterDateStart).toLocaleDateString()}` : '',
            filterDateEnd ? `To: ${new Date(filterDateEnd).toLocaleDateString()}` : ''
        ].filter(Boolean).join('; ');

        let reportHtml = `
            <div style="font-family: Arial, sans-serif; margin: 20px;">
                <h1 style="text-align: center; color: #333;">${reportTitle}</h1>
                <p style="text-align: center; color: #666;">Generated on: ${new Date().toLocaleDateString()}</p>
                ${filtersUsed ? `<p style="text-align: center; font-size: 0.9em; color: #666;">Filters: ${filtersUsed}</p>` : ''}
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">User</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        displayedExpenses.forEach(expense => {
            reportHtml += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; border: 1px solid #ddd;">${new Date(expense.date).toLocaleDateString()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.userName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.category}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.description}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatUGX(expense.amount)}</td>
                </tr>
            `;
        });
        
        const total = displayedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        reportHtml += `
            <tr style="background-color: #f2f2f2; font-weight: bold;">
                <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatUGX(total)}</td>
            </tr>
        `;

        reportHtml += `
                    </tbody>
                </table>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Expenses Report</title></head><body>');
            printWindow.document.write(reportHtml);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        } else {
            addToast("Could not open print window. Please disable popup blockers.", "error");
        }
    };
  
  const isUserView = currentUser.role === 'user';
  const activeBtnClass = "px-4 py-2 text-sm font-black text-yellow-700 bg-yellow-50 border-b-4 border-yellow-500 rounded-t-xl transition-all uppercase tracking-widest";
  const inactiveBtnClass = "px-4 py-2 text-sm font-bold text-gray-400 border-b-4 border-transparent hover:text-gray-600 hover:border-gray-200 transition-all uppercase tracking-widest";

  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="space-y-6">
        {currentUser.role === 'admin' && (
             <div className="mb-6 border-b border-gray-100 flex items-center justify-between">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('expenses')} className={activeTab === 'expenses' ? activeBtnClass : inactiveBtnClass}>Historical Log</button>
                    <button onClick={() => setActiveTab('categories')} className={activeTab === 'categories' ? activeBtnClass : inactiveBtnClass}>Template Categories</button>
                </nav>
            </div>
        )}

      {activeTab === 'expenses' && (
        <>
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Business Expenses</h2>
                    {isUserView && <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">Daily Log Mode • Read-Only after submission</p>}
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-500 text-[#1A2232] px-6 py-3 rounded-2xl shadow-xl hover:bg-yellow-600 transition-all font-black uppercase text-xs tracking-widest active:scale-95 border border-yellow-600/10">
                <PlusIcon className="w-5 h-5 mr-2" /> Add Expense
                </button>
            </div>

            {currentUser.role === 'admin' && (
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>Staff Member</label>
                            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="block w-full rounded-xl border-gray-200 bg-gray-50 py-2 px-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none">
                                <option value="">All Users</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>Expense Type</label>
                            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="block w-full rounded-xl border-gray-200 bg-gray-50 py-2 px-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none">
                                <option value="">All Categories</option>
                                {expenseCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>From Date</label>
                            <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="block w-full rounded-xl border-gray-200 bg-gray-50 py-2 px-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>To Date</label>
                            <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="block w-full rounded-xl border-gray-200 bg-gray-50 py-2 px-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
                        </div>
                        <div className="lg:col-span-1 flex items-end gap-2">
                             <button onClick={handleExportCSV} className="flex items-center justify-center flex-1 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm">
                                <DocumentTextIcon className="w-4 h-4 mr-1.5" /> CSV
                            </button>
                            <button onClick={handleExportPDF} className="flex items-center justify-center flex-1 bg-rose-50 text-rose-700 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 shadow-sm">
                                <PrintIcon className="w-4 h-4 mr-1.5" /> PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-50">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-[10px] text-gray-400 uppercase bg-gray-50/50 font-black tracking-widest">
                        <tr>
                            <th scope="col" className="px-8 py-5">Record Date</th>
                            {currentUser.role === 'admin' && <th scope="col" className="px-8 py-5">Author</th>}
                            <th scope="col" className="px-8 py-5">Category</th>
                            <th scope="col" className="px-8 py-5">Narration</th>
                            <th scope="col" className="px-8 py-5 text-right">Value</th>
                            {currentUser.role === 'admin' && <th scope="col" className="px-8 py-5 text-center">Actions</th>}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {displayedExpenses.map((expense, index) => (
                            <tr key={expense.id} className="bg-white hover:bg-gray-50 transition-colors slide-in-up group" style={{ animationDelay: `${index * 20}ms` }}>
                                <td className="px-8 py-4 font-bold text-gray-600">{new Date(expense.date).toLocaleDateString([], { dateStyle: 'medium' })}</td>
                                {currentUser.role === 'admin' && <td className="px-8 py-4 font-bold text-blue-600">{expense.userName}</td>}
                                <td className="px-8 py-4">
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{expense.category}</span>
                                </td>
                                <th scope="row" className="px-8 py-4 font-bold text-gray-900 truncate max-w-xs">{expense.description}</th>
                                <td className="px-8 py-4 text-right font-black text-gray-900">{formatUGX(expense.amount)}</td>
                                {currentUser.role === 'admin' && (
                                    <td className="px-8 py-4">
                                        <div className="flex justify-center items-center space-x-2">
                                            <button onClick={() => handleOpenEditModal(expense)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 hover:scale-110 transition-all"><EditIcon className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteClick(expense)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:scale-110 transition-all"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {displayedExpenses.length === 0 && (
                            <tr>
                                <td colSpan={currentUser.role === 'admin' ? 6 : 4} className="text-center py-24 text-gray-300 font-black uppercase tracking-[0.4em] text-xs">
                                    No expenditure flow detected
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
      )}

      {currentUser.role === 'admin' && activeTab === 'categories' && <CategoryManager {...props} />}

      {/* Add New Expense Modal - High Contrast Dark Inputs */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Disbursement Entry">
        <form onSubmit={handleAddExpense} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="space-y-1.5">
                  <label className={labelStyle}>Date of Occurrence</label>
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} className={darkInput} required />
              </div>
              <div className="space-y-1.5">
                  <label className={labelStyle}>Cost Center (Category)</label>
                  <input type="text" list="expense-categories" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className={darkInput} placeholder="e.g. Supplies, Rent" required />
                  <datalist id="expense-categories">
                      {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                  </datalist>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                  <label className={labelStyle}>Item/Service Description</label>
                  <input type="text" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className={darkInput} required placeholder="Detail the expenditure..." />
              </div>
              <div className="space-y-1.5">
                  <label className={labelStyle}>Amount Cleared (UGX)</label>
                  <input type="number" step="1" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className={`${darkInput} text-xl text-yellow-400`} required placeholder="0" />
              </div>
           </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all hover:bg-blue-700 border border-blue-500/20">Add Expense to Master Log</button>
          </div>
        </form>
      </Modal>

      {editingExpense && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Correct Transaction">
            <form onSubmit={handleUpdateExpense} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Effective Date</label>
                        <input type="date" value={editingExpense.date.split('T')[0]} onChange={e => setEditingExpense({ ...editingExpense, date: e.target.value })} className={darkInput} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Classification</label>
                        <input type="text" list="expense-categories" value={editingExpense.category} onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })} className={darkInput} required />
                        <datalist id="expense-categories">
                            {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                        </datalist>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className={labelStyle}>Narration Detail</label>
                        <input type="text" value={editingExpense.description} onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })} className={darkInput} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Value Corrected (UGX)</label>
                        <input type="number" step="1" value={editingExpense.amount} onChange={e => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })} className={`${darkInput} text-xl text-yellow-400`} required />
                    </div>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all border border-yellow-400/20">Authorize Change</button>
                </div>
            </form>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="Security Authorization"
        message={`This operation will permanently purge the expenditure record for "${expenseToDelete?.description}". Proceed with deletion?`}
      />
    </div>
  );
};

export default ExpensesView;
